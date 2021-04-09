/**
 * Reference: https://minecraft.fandom.com/wiki/Bedrock_Edition_level_format
 */

const process = require('process');
const { LevelDB } = require('leveldb-zlib')
// const pathToDb = '/home/colinjones/projects/mmccoo/world/db1/'
const pathToDb = '/home/colinjones/projects/mmccoo/world/dbMini/db'

const chunkKeyTag = require('./chunkKeyTag');

const villageKeys = [
    /VILLAGE_[0-9a-f\\-]+_DWELLERS/,
    /VILLAGE_[0-9a-f\\-]+_INFO/,
    /VILLAGE_[0-9a-f\\-]+_PLAYERS/,
    /VILLAGE_[0-9a-f\\-]+_POI/,
    /map_\\-[0-9]+/
]


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
    const it = db.getIterator({keys:true,values:true});
    
    while(!it.finished){
        count++;
        // let record = await it.next()
        let [k, v] = await it.next();
        if(!k){
            // Should not be...
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
            const version = v[0]
            const num_storage_blocks = v[1]
            console.log(`SubChunk " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`,
                         version, num_storage_blocks, v.length)
            
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

                console.log(`PaletteSize:${psize}, PaletteOffset:${paletteoffset}`);

                //std::vector<int> block_types;
                let block_types = []
                for(let i=0; i<psize; i++) {
                    //BlockType block_type;
                    [paletteoffset, block_type] = parse_nbt_tag(v, paletteoffset);

                    if (blocknum>0) {
                        // block must be flowing water, etc
                        console.log("blocknum " , blocknum , block_type.get_name() , " " ,block_type.get_string(), "\n");
                    }

                    process.exit();

                    // BlockType::add_block_type(block_type);
                    // int id = BlockType::get_block_type_id(block_type);
                    // block_types.push_back(id);
                }

                // this is important. there's usually only one block, but sometimes more.
                curoffset = paletteoffset;

                // Blocks are stored in XZY order (i.e. incrementing Y first)
                for (let i=0; i<4096; i++) {
                    // int32_t maskval = get_intval(v, block_data_offset+(i/blocksPerWord)*4);
                    // long unsigned int block_val = (maskval >> ((i%blocksPerWord)*bitsPerBlock)) & ((1<<bitsPerBlock)-1);
                    // if (block_val >= block_types.size()) {
                    //     std::cout << "oob\n";
                    // }

                    // int block_type_id = block_types[block_val];
    // #if 0
    //                 int x = chunkx*16   + ((i>>8) & 0xf);
    //                 int z = chunkz*16   + ((i>>4) & 0xf);
    //                 int y = chunky*16   + ((i>>0) & 0xf);
    //                 // doing it this way is a bit slow since the subchunk has to be looked up every time.
    //                 // but we're loading data chunk by chunk.
    //                 world.set_type_at(x,y,z, block_types[block_val]);
    // #else

                    // int x = ((i>>8) & 0xf);
                    // int z = ((i>>4) & 0xf);
                    // int y = ((i>>0) & 0xf);

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
                total_blocks++;
            }
        } else if ((k.length == 14) && (k[12] == 0x2f)) {
            // i'm skipping nether and end for the moment.
            
            // neo is nether(1), end(2), overworld(omitted).
            // let neo = get_intval(k,8);
            
            chunky = k[11];
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
            //     console.log('Biggggggg ', k.toString())//, v.toString());
            // }
            //console.log(`${chunkx},${chunky},${chunkz} ${k[8]}`)
            // console.log(k.toString());
        }
        //con}sole.log(record);
    }
    console.log(`Count ${count}`)
    return db.close()
}

function parse_nbt_tag(slice, offset, obj){
    obj = obj || {};
    console.log(offset, slice.slice(offset, offset+4))

    let lOffset = parseInt( offset);
    let id = slice[lOffset]
    console.log(`ID:${id}`)
    if(!id || id > 10){
        console.warn(`Incorrect ID:${id}`)
        process.exit();
    }else{

        lOffset++;

        
        let len = (slice[lOffset]) | (slice[lOffset+1] << 8)
        console.log(slice[lOffset], (slice[lOffset+1]))
        lOffset+=2
        
        console.log('**** ', slice.slice(lOffset))
        console.log('**** ',  slice.slice(lOffset).toString())

        let tagname = slice.slice(lOffset, lOffset + len).toString()
        console.log(`TagName: "${tagname}", lenght: ${len}`)
        lOffset += len;
        [obj, lOffset] = parse_nbt_payload(slice, lOffset, tagname, id, obj, ' ')
    
    }
    
    return  [obj, lOffset]
}

function parse_nbt_payload(slice, offset, tagname, id, obj, indent){
    switch(id){
        case 10: // compound type
            while(slice[offset] != 0){
                [obj, offset] = parse_nbt_tag(slice, offset, obj)
            }
            break;
        case 8: // string
            let stringLength = slice.readInt16LE(offset);
            console.log(`StringLength:${stringLength}`)
            offset+=2
            let stringValue = slice.slice(offset, offset+stringLength);
            console.log(`StringValue: "${stringValue}"`);
            offset += stringLength;
            obj[tagname] = stringValue;
        case 1: // byte
            obj[tagname] = slice[offset];
            offset++;

    }
    return [obj, offset]
}

function resolveNamedEntry(k){
    return
}


go().then(complete=>{
    console.log('Complete', complete)
})