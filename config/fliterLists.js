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
    // 'minecraft:diamond_ore',
    //'minecraft:lapis_ore'
];

export {villageKeys, BLOCK_WHITELIST, BLOCK_BLACKLIST}