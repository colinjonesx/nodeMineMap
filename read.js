/**
 * Reference: https://minecraft.fandom.com/wiki/Bedrock_Edition_level_format
 */

import { LevelDB } from 'leveldb-zlib';
import { parseDataPayload } from './utils/dataParsing.js';
import { getRoutedList, calcDistance } from './utils/listHelpers.js';
import { villageKeys } from './config/filterLists.js';
import './config/chunkKeyTag.js';

function routeInteresting(allInteresting, targetNumber, startingLocation) {
  console.log(`Finding closest ${targetNumber} items from ${JSON.stringify(startingLocation)}`);
  allInteresting.forEach((el) => {
    el.distance = calcDistance(startingLocation, el);
  });

  allInteresting.sort((a, b) => a.distance - b.distance);

  const shortList = allInteresting.slice(0, targetNumber);
  const routedList = getRoutedList(shortList);

  routedList.forEach((el) => {
    console.log(`X:${el.x}\tY:${el.y}\tZ:${el.z}\t${el.block_name}\t${el.distance}`);
  });
}

async function go(pathToDb, startingLocation) {
  const db = new LevelDB(pathToDb, { createIfMissing: false });
  await db.open();

  console.log(` ${db.status}`);

  // console.log(await db.getProperty('leveldb.stats'))
  // console.log('Approx Size', db.approximateSize())

  let interestingBlocks = [];
  const it = db.getIterator({ keys: true, values: true });

  while (!it.finished) {
    // eslint-disable-next-line no-await-in-loop
    const [k, v] = await it.next();
    if (!k) {
      console.error('Key not found');
      process.exit(1);
    }
    const chunkx = k.length > 4 ? k.readInt32LE(0) : 0;
    const chunkz = k.length > 8 ? k.readInt32LE(4) : 0;

    let chunky = -1;

    let strMatch = false;
    Object.values(villageKeys).forEach((r) => {
      if (typeof r === 'object' && r.test(k.toString())) { // RegExp
        strMatch = true;
      }
    });

    if (strMatch) {
      console.log(k.toString());
    } else if ((k.length === 10) && (k[8] === 0x2f)) { // 2f = SubChunk
      const shortYIdx = 9;
      chunky = k[shortYIdx];
      // interesting_blocks = interesting_blocks.concat(
      //   parse_data_payload(v, chunkx, chunky, chunkz, 0));
    } else if ((k.length === 14) && (k[12] === 0x2f)) {
      const longYIdx = 11;
      // neo is nether(1), end(2), overworld(omitted).
      // let neo = get_intval(k,8);
      const dim = k.readInt32LE(8);
      chunky = k[longYIdx];
      interestingBlocks = interestingBlocks.concat(
        parseDataPayload(v, chunkx, chunky, chunkz, dim),
      );
    } else if ((k.length === 13) && (k[12] === 0x2d)) { // Biomes and elevation
    //   const neo = k.readInt32LE(8);
      // console.log(`biomes and elevation for
      // " << ${chunkx} << ${chunky} << ${chunkz} << ", " << ${neo===1 ? "nether" : "end"}`);
    } else if ((k.length === 9) && (k[8] === 0x2d)) {
      // console.log(`biomes and elevation for
      // " << ${chunkx} << ${chunky} << ${chunkz} << ", " << overworld`);
    } else {
      // console.log(`${chunkx},${chunky},${chunkz} ${k[8]}`)
      // console.log(k.toString());
    }
  }

  console.log(`Interesting Block Count ${interestingBlocks.length}`);
  routeInteresting(interestingBlocks, 32, startingLocation);
  // route_interesting(interesting_blocks, 32, {x:31,y:11,z:-7});
  // route_interesting(interesting_blocks, 32, {x:-167,y:10,z:47});
  return db.close();
}

let pathToDb = '/home/colinjones/projects/mmccoo/world/db-210418/';
let startingLocation = { x: 0, y: 70, z: 0 };
const firstArgLocation = 2;
const secondArgLocation = 3;

if (process.argv[firstArgLocation]) {
  pathToDb = process.argv[firstArgLocation];
  if (process.argv[secondArgLocation]) {
    const coords = process.argv[secondArgLocation].split(',');
    startingLocation = {
      x: parseInt(coords[0], 10),
      y: parseInt(coords[1], 10),
      z: parseInt(coords[2], 10),
    };
  }
}

go(pathToDb, startingLocation).then((complete) => {
  console.log('Complete', complete);
});
