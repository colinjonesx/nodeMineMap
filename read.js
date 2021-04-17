/**
 * Reference: https://minecraft.fandom.com/wiki/Bedrock_Edition_level_format
 */

import { exit } from 'process';
import { LevelDB } from 'leveldb-zlib';
const pathToDb = '/home/colinjones/projects/mmccoo/world/db1/'
// const pathToDb = '/home/colinjones/projects/mmccoo/world/dbMini/db'
import { parse_nbt_tag} from './utils/nbtParsing.js'
import {villageKeys, BLOCK_WHITELIST, BLOCK_BLACKLIST} from './config/fliterLists.js';
import './config/chunkKeyTag.js';

function route_interesting(all_interesting, target_number, starting_location){
    
    console.log(`Finding closest ${target_number} items from ${JSON.stringify(starting_location)}`);
     all_interesting.forEach((el, i, orig) => {
        orig[i].distance = 1*Math.pow(
            Math.pow(starting_location.x - el.x, 2) +
            Math.pow(starting_location.y - el.y, 2) +
            Math.pow(starting_location.z - el.z, 2),
            0.5);
        // console.log(el.distance);
     })

     all_interesting.sort((a, b)=> a.distance - b.distance);

     let short_list = all_interesting.slice(0, target_number);
    //  console.log(short_list)
     for(let i = 1; i< short_list.length; i++){
        // console.log(Math.pow(Math.pow(starting_location.x - short_list[i].x, 2) +
        //                     Math.pow(starting_location.y - short_list[i].y, 2) +
        //                     Math.pow(starting_location.z - short_list[i].z, 2),
        //                     0.5));
         
        // console.log(short_list[i-1].distance - short_list[i].distance);
     }
     short_list.forEach(el =>{
         console.log(`X:${el.x}\tY:${el.y}\tZ:${el.z}\t${el.block_name}\t${el.distance}`)
     })
}

async function go(){
    let db = new LevelDB(pathToDb, { createIfMissing: false })
    await db.open()
    
    console.log(` ${db.status}`)
    
    // console.log(await db.getProperty('leveldb.stats'))
    // console.log('Approx Size', db.approximateSize())
    let count = 0
    
    let interesting_blocks = [];
    const it = db.getIterator({keys:true,values:true});
    
    while(!it.finished){
        count++;
        let [k, v] = await it.next();
        if(!k){
            console.error('Key not found');
            process.exit(1);
        }
        let chunkx = k.length > 4 ? k.readInt32LE(0) : 0;
        let chunkz = k.length > 8 ? k.readInt32LE(4) : 0;
        
        let chunky = -1;

        let strMatch = false;
        for (let r in villageKeys){
            if(typeof r ==='RegExp' && r.test(k.toString())){
                strMatch = true;
            }
        }

        if(strMatch){
            console.log(k.toString())
        }else if ((k.length === 10) && (k[8] == 0x2f)) { // 2f = SubChunk
            chunky = k[9];
            // interesting_blocks = interesting_blocks.concat(parse_data_payload(v, chunkx, chunky, chunkz, 0));
            
        } else if ((k.length == 14) && (k[12] == 0x2f)) {
            // neo is nether(1), end(2), overworld(omitted).
            // let neo = get_intval(k,8);
            let dim = k.readInt32LE(8);
            chunky = k[11];
            interesting_blocks = interesting_blocks.concat(parse_data_payload(v, chunkx, chunky, chunkz, dim));
        } else if ((k.length == 13) && (k[12] == 0x2d)) { // Biomes and elevation
            let neo = k.readInt32LE(8);
            // console.log(`biomes and elevation for " << ${chunkx} << ${chunky} << ${chunkz} << ", " << ${neo===1 ? "nether" : "end"}`);
            continue;
        }else if ((k.length == 9) && (k[8] == 0x2d)) {
            // console.log(`biomes and elevation for " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`);
        }else{
            //console.log(`${chunkx},${chunky},${chunkz} ${k[8]}`)
            // console.log(k.toString());
        }
        
    }
    
    console.log(`Interesting Block Count ${interesting_blocks.length}`)
    route_interesting(interesting_blocks, 32, {x:115,y:12,z:90});
    // route_interesting(interesting_blocks, 32, {x:31,y:11,z:-7});
    // route_interesting(interesting_blocks, 32, {x:-167,y:10,z:47});
    return db.close()
}

function parse_data_payload(v, chunkx, chunky, chunkz, dim){
    const interesting_blocks = []
    const version = v[0]
    const num_storage_blocks = v[1]
    // console.log(`SubChunk " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`,
    //                 version, num_storage_blocks, v.length)
    
    let curoffset = 2;
    for(let blocknum=0; blocknum<num_storage_blocks; blocknum++) {
        let storageVersion = v[curoffset];
        curoffset++;
        let bitsPerBlock = storageVersion >> 1
        let blocksPerWord = Math.floor(32/bitsPerBlock);
        let numInts = Math.ceil(4096/blocksPerWord);

        // console.log(`BpB:${bitsPerBlock}, BpW:${blocksPerWord}, NI:${numInts}`)
        if([1,2,3,4,5,6,8,16].indexOf(bitsPerBlock) === -1){
            // incorrect state
            console.warn(`Incorrent state BpB:${bitsPerBlock}`);
            continue;
        }
        let block_data_offset = 0+curoffset;
        let paletteoffset = block_data_offset+4*numInts;

        let psize = v.readInt32LE(paletteoffset);
        paletteoffset += 4;

        // console.log(`PaletteSize:${psize}, PaletteOffset:${paletteoffset}`);
        let block_type;
        let block_types = []
        
        for(let i=0; i<psize; i++) {
            //BlockType block_type;
            [block_type, paletteoffset] = parse_nbt_tag(v, paletteoffset);

            if (blocknum>0) {
                // block must be flowing water, etc
                //console.log('Block 2??!!?')
                //console.log("blocknum " , blocknum , block_type.get_name() , " " ,block_type.get_string(), "\n");
            }

            block_types.push(block_type)
        }

        // this is important. there's usually only one block, but sometimes more.
        curoffset = paletteoffset;

        // Blocks are stored in XZY order (i.e. incrementing Y first)
        for (let i=0; i<4096; i++) {
            // console.log('DBO',block_data_offset)
            let maskval = v.readInt32LE(block_data_offset+Math.floor(i/blocksPerWord)*4);
            let block_val = (maskval >> ((i%blocksPerWord)*bitsPerBlock)) & ((1<<bitsPerBlock)-1);

            if (block_val >= block_types.length) {
                console.warn(`Block Value [${block_val}] out of palette bounds`);
                process.exit(1);
            }
            //console.log('Block Value', block_val, v.slice())

            let block_type_id = block_types[block_val];
// #if 0
            let x = chunkx*16   + ((i>>8) & 0xf);
            let z = chunkz*16   + ((i>>4) & 0xf);
            let y = chunky*16   + ((i>>0) & 0xf);
//                 // doing it this way is a bit slow since the subchunk has to be looked up every time.
//                 // but we're loading data chunk by chunk.
//                 world.set_type_at(x,y,z, block_types[block_val]);
// #else

            // let x = ((i>>8) & 0xf);
            // let z = ((i>>4) & 0xf);
            // let y = ((i>>0) & 0xf);
            if( BLOCK_WHITELIST.indexOf(block_types[block_val].name) >= 0){
                //console.log(`x:${x}, y:${y}, z:${z} ${block_types[block_val].name}`);
                interesting_blocks.push({
                    x,
                    y,
                    z,
                    block_name:block_types[block_val].name
                })
            }
            else if(BLOCK_WHITELIST.length === 0 && BLOCK_BLACKLIST.indexOf(block_types[block_val].name) === -1){
                console.log(`x:${x}, y:${y}, z:${z} ${block_types[block_val].name}`);
            }
            

            // BlockType &bt = BlockType::get_block_type_by_id(block_type_id);
            // if (blocknum==0) {
            //     curchunk->set_type_at(x,y,z, block_type_id);
            //     bt.incr_count();
            // } else {
            //     if(bt.get_name() != "minecraft:air") {
            //         std::cout << "alternate at " << chunkx*16+x << ", " << chunky*16+y << ", " << chunkz*16+z << bt.get_name() << "\n";
            //     }
            // }

        }
        // total_blocks++;
    }
    return interesting_blocks
}

go().then(complete=>{
    console.log('Complete', complete)
})