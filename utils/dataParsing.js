import { BLOCK_WHITELIST, BLOCK_BLACKLIST } from '../config/filterLists.js';

function parseNbtPayload(slice, passedOffset, tagname, id, passedObj, indent) {
  let obj = passedObj;
  let offset = passedOffset;
  switch (id) {
    case 10: { // compound type
      // console.log(`Compound Type, Tagname: ${tagname}`)
      while (slice[offset] !== 0) { // zero being NBTTags-End type
        [obj, offset] = parseNbtTag(slice, offset, obj);
      }
      offset += 1;
      break;
    }
    case 8: { // string
      const stringLength = slice.readInt16LE(offset);
      offset += 2;
      const stringValue = slice.slice(offset, offset + stringLength).toString();
      // console.log(`String: ${tagname} "${stringValue}"`);
      offset += stringLength;
      obj[tagname] = stringValue;
      break;
    }
    case 3: { // Int
      obj[tagname] = slice.readInt32LE(offset);
      // console.log(`Integer: ${tagname},${obj[tagname]}`);
      offset += 4;// TODO: figure why this is 5 not 4 as expected
      break;
    }
    case 1: { // byte
      // console.log('BYTE')
      obj[tagname] = slice[offset];
      offset += 1;// TODO: figure why this is 2 not 1 as expected
      break;
    }
    default: {
      console.log('UNHANDLED NBT Payload');
    }
  }
  return [obj, offset];
}

function parseNbtTag(slice, offset, passedObj) {
  // console.log(offset, slice.slice(offset, offset+4, obj))
  let obj = passedObj || {};

  let localOffset = parseInt(offset, 10);
  const id = slice[localOffset];
  localOffset += 1;
  // console.log(`[ID: ${id}]`)
  if (typeof id === 'undefined' || id > 10) {
    console.warn(`Incorrect ID:${id}`);
    process.exit();
  } else {
    const len = (slice[localOffset]) | (slice[localOffset + 1] << 8);
    localOffset += 2;
    // console.log(slice[lOffset], (slice[lOffset+1]))

    // console.log('  **** ', slice.slice(lOffset))
    // console.log('  **** ',  slice.slice(lOffset, lOffset + 40).toString())
    // console.log('  ****')

    const tagname = slice.slice(localOffset, localOffset + len).toString();
    // console.log(`TagName: "${tagname}", length: ${len}`)
    localOffset += len;
    [obj, localOffset] = parseNbtPayload(slice, localOffset, tagname, id, obj, ' ');
  }
  return [obj, localOffset];
}

function parseDataPayload(v, chunkx, chunky, chunkz, dim) {
  const interestingBlocks = [];
  // const version = v[0];
  const storageBlocksCount = v[1];
  // console.log(`SubChunk " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`,
  //                 version, num_storage_blocks, v.length)

  let curoffset = 2;
  for (let blockNum = 0; blockNum < storageBlocksCount; blockNum++) {
    const storageVersion = v[curoffset];
    curoffset += 1;
    const bitsPerBlock = storageVersion >> 1;
    const blocksPerWord = Math.floor(32 / bitsPerBlock);
    const numInts = Math.ceil(4096 / blocksPerWord);

    // console.log(`BpB:${bitsPerBlock}, BpW:${blocksPerWord}, NI:${numInts}`)
    if ([1, 2, 3, 4, 5, 6, 8, 16].indexOf(bitsPerBlock) === -1) {
      // incorrect state
      console.warn(`Incorrent state BpB:${bitsPerBlock}`);
      process.exit();
    }
    const blockDataOffset = 0 + curoffset;
    let paletteoffset = blockDataOffset + 4 * numInts;

    const psize = v.readInt32LE(paletteoffset);
    paletteoffset += 4;

    // console.log(`PaletteSize:${psize}, PaletteOffset:${paletteoffset}`);
    let blockType;
    const blockTypes = [];

    for (let i = 0; i < psize; i++) {
      // BlockType block_type;
      [blockType, paletteoffset] = parseNbtTag(v, paletteoffset);

      if (blockNum > 0) {
        // block must be flowing water, etc
        // console.log('Block 2??!!?')
      }

      blockTypes.push(blockType);
    }

    // this is important. there's usually only one block, but sometimes more.
    curoffset = paletteoffset;

    // Blocks are stored in XZY order (i.e. incrementing Y first)
    for (let i = 0; i < 4096; i++) {
      // console.log('DBO',block_data_offset)
      const maskval = v.readInt32LE(blockDataOffset + Math.floor(i / blocksPerWord) * 4);
      const blockValue = (maskval >> ((i % blocksPerWord) * bitsPerBlock))
                        & ((1 << bitsPerBlock) - 1);

      if (blockValue >= blockTypes.length) {
        console.warn(`Block Value [${blockValue}] out of palette bounds`);
        process.exit(1);
      }
      // console.log('Block Value', block_val, v.slice())

      const x = chunkx * 16 + ((i >> 8) & 0xf);
      const z = chunkz * 16 + ((i >> 4) & 0xf);
      const y = chunky * 16 + ((i >> 0) & 0xf);
      if (BLOCK_WHITELIST.indexOf(blockTypes[blockValue].name) >= 0) {
        // console.log(`x:${x}, y:${y}, z:${z} ${block_types[block_val].name}`);
        interestingBlocks.push({
          x,
          y,
          z,
          block_name: blockTypes[blockValue].name,
          dim,
        });
      } else if (BLOCK_WHITELIST.length === 0
        && BLOCK_BLACKLIST.indexOf(blockTypes[blockValue].name) === -1) {
        console.log(`x:${x}, y:${y}, z:${z} ${blockTypes[blockValue].name}`);
      }
    }
    // total_blocks++;
  }
  return interestingBlocks;
}

export { parseDataPayload, parseNbtPayload, parseNbtTag };
