

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

export {parse_nbt_payload, parse_nbt_tag}