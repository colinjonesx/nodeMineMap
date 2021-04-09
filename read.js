/**
 * Reference: https://minecraft.fandom.com/wiki/Bedrock_Edition_level_format
 */

const process = require('process');
const { LevelDB } = require('leveldb-zlib')
const pathToDb = '/home/colinjones/projects/mmccoo/world/db1/'
// const pathToDb = '/home/colinjones/projects/mmccoo/world/dbMini/db'

const chunkKeyTag = require('./chunkKeyTag');

const villageKeys = [
    /VILLAGE_[0-9a-f\\-]+_DWELLERS/,
    /VILLAGE_[0-9a-f\\-]+_INFO/,
    /VILLAGE_[0-9a-f\\-]+_PLAYERS/,
    /VILLAGE_[0-9a-f\\-]+_POI/,
    /map_\\-[0-9]+/
]

const BLOCK_BLACKLIST = [
    'minecraft:netherrack',
    'minecraft:lava',
    'minecraft:soul_soil',
    'minecraft:soul_sand',
    'minecraft:basalt',
    'minecraft:nether_gold_ore',
    'minecraft:quartz_ore',
    'minecraft:magma',
    'minecraft:blackstone',
    'minecraft:stone',
    'minecraft:gravel',
    'minecraft:bedrock',
    'minecraft:air',
    'minecraft:water',
    'minecraft:dirt',
    'minecraft:grass',
    'minecraft:sand',
    'minecraft:sandstone'
]
const BLOCK_WHITELIST = [
    'minecraft:ancient_debris'
];


function route_interesting(all_interesting, target_number, starting_location){
    console.log(`Finding closest ${target_number} items`);
     all_interesting.forEach(el => {
         el.distance = Math.pow(
             Math.pow(starting_location.x - el.x, 2) +
             Math.pow(starting_location.y - el.y, 2) +
             Math.pow(starting_location.z - el.z, 2),
             -2);
     })

     all_interesting.sort((a, b)=> a.distance = b.distance);

     for(let i=0; i<target_number; i++){
         console.log(all_interesting[i]);
     }




}

async function go(){
    let db = new LevelDB(pathToDb, { createIfMissing: false })
    await db.open()
    // await db.put("Key", "Value")
    // let val = await db.getAsString("Key")
    // console.assert("Value" == val)
    console.log( db.status)
    console.log(await db.getProperty('leveldb.stats'))
    // console.log('Approx Size', db.approximateSize())
    let count = 0
    let total_blocks = 0;
    let interesting_blocks = [];
    const it = db.getIterator({keys:true,values:true});
    
    while(!it.finished){
        count++;
        // let record = await it.next()
        let [k, v] = await it.next();
        if(!k){
            // Should not be...
            process.exit()
            continue;
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
            //parse_data_payload(v, chunkx, chunky, chunkz);
        } else if ((k.length == 14) && (k[12] == 0x2f)) {
            // i'm skipping nether and end for the moment.
            
            // neo is nether(1), end(2), overworld(omitted).
            // let neo = get_intval(k,8);
            
            chunky = k[11];
            interesting_blocks = interesting_blocks.concat(parse_data_payload(v, chunkx, chunky, chunkz));
        } else if ((k.length == 13) && (k[12] == 0x2d)) {
            let neo = k.readInt32LE(8);

            // console.log(`biomes and elevation for " << ${chunkx} << ${chunky} << ${chunkz} << ", " << ${neo===1 ? "nether" : "end"}`);

            continue;
        }else if ((k.length == 9) && (k[8] == 0x2d)) {
            // console.log(`biomes and elevation for " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`);
        }else{
            // if(k.length<9){
            //     console.log('Smalllllll ', k.toString())//, v.toString());
            // }else if(k.length > 14){
            //     console.log('Bpiggggggg ', k.toString())//, v.toString());
            // }
            //console.log(`${chunkx},${chunky},${chunkz} ${k[8]}`)
            // console.log(k.toString());
        }
        //con}sole.log(record);
    }
    //console.log(`Interesting Block Count ${JSON.stringify(interesting_blocks)}`)
    console.log(`Interesting Block Count ${interesting_blocks.length}`)
    route_interesting(interesting_blocks, 10, {x:0,y:75,z:0});
    return db.close()
}

function parse_data_payload(v, chunkx, chunky, chunkz, neo){
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

        //std::vector<int> block_types;
        let block_types = []
        
        for(let i=0; i<psize; i++) {
            //BlockType block_type;
            [block_type, paletteoffset] = parse_nbt_tag(v, paletteoffset);

            if (blocknum>0) {
                // block must be flowing water, etc
                console.log('Block 2??!!?')
                //console.log("blocknum " , blocknum , block_type.get_name() , " " ,block_type.get_string(), "\n");
            }

            block_types.push(block_type)

            //console.log('Palette Block Parsed', block_type, paletteoffset)

            //process.exit();

            // BlockType::add_block_type(block_type);
            // int id = BlockType::get_block_type_id(block_type);
            // block_types.push_back(id);
        }
        // console.log(block_types)

        // this is important. there's usually only one block, but sometimes more.
        curoffset = paletteoffset;

        // Blocks are stored in XZY order (i.e. incrementing Y first)
        for (let i=0; i<4096; i++) {
            // console.log('DBO',block_data_offset)
            let maskval = v.readInt32LE(block_data_offset+Math.floor(i/blocksPerWord)*4);
            let block_val = (maskval >> ((i%blocksPerWord)*bitsPerBlock)) & ((1<<bitsPerBlock)-1);

            if (block_val >= block_types.length) {
                console.warn(`Block Value [${block_val}] out of palette bounds`);
                process.exit()
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

function parse_nbt_tag(slice, offset, obj){
    //console.log(offset, slice.slice(offset, offset+4, obj))
    obj = obj || {};

    let lOffset = parseInt( offset);
    let id = slice[lOffset]
    lOffset++;
    // console.log(`[ID: ${id}]`)
    if( typeof id === 'undefined' || id > 10){
        console.warn(`Incorrect ID:${id}`)
        process.exit();
    }else{        
        let len = (slice[lOffset]) | (slice[lOffset+1] << 8)
        lOffset+=2
        //console.log(slice[lOffset], (slice[lOffset+1]))
        
        // console.log('  **** ', slice.slice(lOffset))
        // console.log('  **** ',  slice.slice(lOffset, lOffset + 40).toString())
        // console.log('  ****')

        let tagname = slice.slice(lOffset, lOffset + len).toString()
        // console.log(`TagName: "${tagname}", length: ${len}`)
        lOffset += len;
        [obj, lOffset] = parse_nbt_payload(slice, lOffset, tagname, id, obj, ' ')
    
    }
    
    return  [obj, lOffset]
}

function parse_nbt_payload(slice, offset, tagname, id, obj, indent){
    switch(id){
        case 10: // compound type
            //console.log(`Compound Type, Tagname: ${tagname}`)
            while(slice[offset] != 0){ // zero being NBTTags-End type
                [obj, offset] = parse_nbt_tag(slice, offset, obj)
            }
            //console.log('   ***** FOUND END TAG', obj)
            offset++;
            break;
        case 8: // string
            let stringLength = slice.readInt16LE(offset);
            offset+=2
            let stringValue = slice.slice(offset, offset+stringLength).toString();
            //console.log(`String: ${tagname} "${stringValue}"`);
            offset += stringLength;
            obj[tagname] = stringValue;
            break;
        case 3: // Int
            obj[tagname] = slice.readInt32LE(offset);
            //console.log(`Integer: ${tagname},${obj[tagname]}`);
            offset+=4;// TODO: figure why this is 5 not 4 as expected
            break;
        case 1: // byte
            //console.log('BYTE')
            obj[tagname] = slice[offset];
            offset+=1;// TODO: figure why this is 2 not 1 as expected
            break;
        default:
            console.log('UNHANDLED NBT Payload')
    }
    return [obj, offset]
}


go().then(complete=>{
    console.log('Complete', complete)
})