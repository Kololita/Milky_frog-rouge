export const SHAPE_CATALOG={
  white:{
    "white-domino":["##"],
    "white-elbow":["#.","##"],
    "white-bar":["###"],
    "white-single":["#"],
  },
  green:{
    "green-square":["##","##"],
    "green-tee":["###",".#."],
    "green-hook":["#..","###"],
    "green-four-bar":["####"],
    "green-hinge-bridge":["##*##"],
    "green-diagonal-hook":["##.##","..*.."],
    "green-diagonal-blank":["##.##","..#.."],
    "green-zig":[".##","##."],
    "green-cross":[".#.","###",".#."],
    "green-vacuum":[".#.","#.#",".#."],
  },
  blue:{
    "blue-block":["###","###"],
    "blue-guard":["#.#","###","#.#"],
    "blue-split-hook":["#..","##.","#.#","#.#"],
    "blue-stepped-spur":["#..","#.#","##.","#.."],
    "blue-double-hinge":["#*#*##"],
    "blue-diagonal-chain":["#....",".*...","..#..","...*.","....#"],
    "blue-diagonal-blank":["#....",".#...","..#..","...#.","....#"],
    "blue-fork":["####","#..#"],
    "blue-hook":["#..","##.","###","..#"],
    "blue-side-cross":["#..","#..","###","#.."],
    "blue-stair":["##.",".##",".##"],
    "skill-fixed-focus":["#.#",".#.","#.#"],
    "skill-fixed-longarm":["...#",".#.#","###."],
    "skill-fixed-drain":[".##.","##.#","..##"],
  },
  purple:{
    "purple-offset-bridge":["##.##",".#.#.",".###."],
    "purple-step":["###",".##","###"],
    "purple-claw":["###.","#.##","###."],
    "purple-ring":["###","#.#","###"],
    "purple-diagonal-wings":["#...#","#*.*#","..#.."],
    "purple-gate":["#..#","####",".##."],
    "purple-river":["##..",".###","..##","...#"],
    "purple-open-claw":["###.","#..#","####"],
    "purple-bridge":["##.##",".###.",".#.#."],
    "skill-fixed-shield":["###","###",".#."],
  },
  gold:{
    "gold-s":["###","#..","###","..#","###"],
    "gold-crown":["##.##",".###.","#####"],
    "gold-diagonal-star":["..#..",".#.#.","#.#.#",".#.#.","..#.."],
    "gold-c":["####","#...","#...","#...","####"],
    "gold-cuirass":["##.##","#####",".###.",".###."],
    "gold-bastion":["##..","###.",".###","..##"],
    "gold-titan":["###.#","#.###","###.."],
    "gold-e":["###","#..","###","#..","###"],
    "gold-sword":["..#..","..##.","..##.","#####","..#..",".###."],
    "gold-talons":["#.#.#","#####",".###.","..#.."],
    "gold-star":["..#..",".###.","#####",".###.","..#.."],
    "gold-pendant":[".###.",".#.#.",".###.",".###.","..#.."],
  },
};

export const AUTHORED_SHAPE_POOLS={
  armor:{
    "white":[{"id":"white-domino","weight":1.07},{"id":"white-elbow","weight":1.61},{"id":"white-bar","weight":1.59}],
    "green":[{"id":"green-square","weight":1.05},{"id":"green-tee","weight":1.08},{"id":"green-hook","weight":1.07},{"id":"green-four-bar","weight":1.08},{"id":"green-hinge-bridge","weight":1.3},{"id":"green-diagonal-hook","weight":1.35},{"id":"green-diagonal-blank","weight":1.35}],
    "blue":[{"id":"blue-block","weight":0.93},{"id":"blue-guard","weight":1.24},{"id":"blue-split-hook","weight":0.95},{"id":"blue-stepped-spur","weight":0.94},{"id":"blue-double-hinge","weight":0.92},{"id":"blue-diagonal-chain","weight":1.03},{"id":"blue-diagonal-blank","weight":1.03}],
    "purple":[{"id":"purple-offset-bridge","weight":1.47},{"id":"purple-step","weight":0.94},{"id":"purple-claw","weight":1.11},{"id":"purple-ring","weight":1.1},{"id":"purple-diagonal-wings","weight":1.04}],
    "gold":[{"id":"gold-s","weight":1.08},{"id":"gold-crown","weight":1.07},{"id":"gold-diagonal-star","weight":1.33},{"id":"gold-c","weight":0.86},{"id":"gold-cuirass","weight":1.5},{"id":"gold-bastion","weight":0.98}],
  },
  weapon:{
    "white":[{"id":"white-domino","weight":1.07},{"id":"white-bar","weight":1.59},{"id":"white-elbow","weight":1.61}],
    "green":[{"id":"green-hook","weight":1.07},{"id":"green-zig","weight":1.09},{"id":"green-cross","weight":1.38},{"id":"green-four-bar","weight":1.08},{"id":"green-hinge-bridge","weight":1.3},{"id":"green-diagonal-hook","weight":1.35},{"id":"green-diagonal-blank","weight":1.35}],
    "blue":[{"id":"blue-fork","weight":0.95},{"id":"blue-hook","weight":0.96},{"id":"blue-guard","weight":1.17},{"id":"blue-side-cross","weight":0.95},{"id":"blue-double-hinge","weight":0.95},{"id":"blue-diagonal-chain","weight":1.02},{"id":"blue-diagonal-blank","weight":1.02}],
    "purple":[{"id":"purple-gate","weight":1.12},{"id":"purple-river","weight":0.99},{"id":"purple-open-claw","weight":1.21},{"id":"purple-ring","weight":1.07},{"id":"purple-diagonal-wings","weight":1.04}],
    "gold":[{"id":"gold-titan","weight":1.03},{"id":"gold-e","weight":1.15},{"id":"gold-crown","weight":1.13},{"id":"gold-c","weight":1.0},{"id":"gold-sword","weight":1.5},{"id":"gold-talons","weight":1.24}],
  },
  accessory:{
    "white":[{"id":"white-single","weight":0.5},{"id":"white-domino","weight":1.07},{"id":"white-elbow","weight":1.61},{"id":"white-bar","weight":1.59}],
    "green":[{"id":"green-tee","weight":1.08},{"id":"green-vacuum","weight":1.23},{"id":"green-zig","weight":1.09},{"id":"green-cross","weight":1.38},{"id":"green-four-bar","weight":1.08},{"id":"green-hinge-bridge","weight":1.3},{"id":"green-diagonal-hook","weight":1.35},{"id":"green-diagonal-blank","weight":1.35}],
    "blue":[{"id":"blue-stair","weight":0.92},{"id":"blue-guard","weight":1.29},{"id":"blue-hook","weight":0.94},{"id":"blue-side-cross","weight":0.92},{"id":"blue-double-hinge","weight":0.92},{"id":"blue-diagonal-chain","weight":1.03},{"id":"blue-diagonal-blank","weight":1.03}],
    "purple":[{"id":"purple-river","weight":0.92},{"id":"purple-bridge","weight":1.33},{"id":"purple-step","weight":0.9},{"id":"purple-ring","weight":0.94},{"id":"purple-diagonal-wings","weight":0.97}],
    "gold":[{"id":"gold-star","weight":1.48},{"id":"gold-crown","weight":1.07},{"id":"gold-e","weight":1.07},{"id":"gold-c","weight":0.92},{"id":"gold-pendant","weight":1.07}],
  },
  skill:{

  },
};

// Exact layouts and multipliers for names recorded by prior versions.
export const LEGACY_SHAPE_POOLS={
  "armor": [
    {
      "id": "white-armor-extra",
      "rarity": "white",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6
    },
    {
      "id": "green-armor-extra",
      "rarity": "green",
      "shape": [
        "####"
      ],
      "weight": 1.08
    },
    {
      "id": "armor-blue-hook",
      "rarity": "blue",
      "shape": [
        "#..",
        "##.",
        "###",
        "..#"
      ],
      "weight": 1.24
    },
    {
      "id": "blue-armor-extra",
      "rarity": "blue",
      "shape": [
        "#..",
        "#..",
        "###",
        "#.."
      ],
      "weight": 1.1
    },
    {
      "id": "armor-purple-bridge",
      "rarity": "purple",
      "shape": [
        "##.##",
        ".###.",
        ".#.#."
      ],
      "weight": 1.19
    },
    {
      "id": "purple-armor-extra",
      "rarity": "purple",
      "shape": [
        "###",
        "#.#",
        "###"
      ],
      "weight": 1.06
    },
    {
      "id": "armor-gold-e",
      "rarity": "gold",
      "shape": [
        "###",
        "#..",
        "###",
        "#..",
        "###"
      ],
      "weight": 1.05
    },
    {
      "id": "armor-gold-star",
      "rarity": "gold",
      "shape": [
        "..#..",
        ".###.",
        "#####",
        ".###.",
        "..#.."
      ],
      "weight": 1.23
    },
    {
      "id": "gold-armor-extra",
      "rarity": "gold",
      "shape": [
        "####",
        "#...",
        "#...",
        "#...",
        "####"
      ],
      "weight": 1.05
    },
    {
      "id": "armor-white-domino",
      "shape": [
        "##"
      ],
      "weight": 1.07,
      "rarity": "white"
    },
    {
      "id": "armor-white-elbow",
      "shape": [
        "#.",
        "##"
      ],
      "weight": 1.61,
      "rarity": "white"
    },
    {
      "id": "armor-white-bar",
      "shape": [
        "###"
      ],
      "weight": 1.59,
      "rarity": "white"
    },
    {
      "id": "white-notch",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6,
      "rarity": "white"
    },
    {
      "id": "armor-green-square",
      "shape": [
        "##",
        "##"
      ],
      "weight": 1.05,
      "rarity": "green"
    },
    {
      "id": "armor-green-tee",
      "shape": [
        "###",
        ".#."
      ],
      "weight": 1.08,
      "rarity": "green"
    },
    {
      "id": "armor-green-hook",
      "shape": [
        "#..",
        "###"
      ],
      "weight": 1.07,
      "rarity": "green"
    },
    {
      "id": "armor-blue-block",
      "shape": [
        "###",
        "###"
      ],
      "weight": 1.03,
      "rarity": "blue"
    },
    {
      "id": "armor-blue-guard",
      "shape": [
        "#.#",
        "###",
        "#.#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "armor-blue-split-hook",
      "shape": [
        "#..",
        "##.",
        "#.#",
        "#.#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "armor-purple-offset-bridge",
      "shape": [
        "##.##",
        ".#.#.",
        ".###."
      ],
      "weight": 1.19,
      "rarity": "purple"
    },
    {
      "id": "armor-purple-step",
      "shape": [
        "###",
        ".##",
        "###"
      ],
      "weight": 1.04,
      "rarity": "purple"
    },
    {
      "id": "armor-purple-claw",
      "shape": [
        "###.",
        "#.##",
        "###."
      ],
      "weight": 1.18,
      "rarity": "purple"
    },
    {
      "id": "armor-gold-crown",
      "shape": [
        "##.##",
        ".###.",
        "#####"
      ],
      "weight": 1.13,
      "rarity": "gold"
    },
    {
      "id": "armor-gold-diagonal-star",
      "shape": [
        "..#..",
        ".#.#.",
        "#.#.#",
        ".#.#.",
        "..#.."
      ],
      "weight": 1.23,
      "rarity": "gold"
    }
  ],
  "weapon": [
    {
      "id": "white-weapon-extra",
      "rarity": "white",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6
    },
    {
      "id": "green-weapon-extra",
      "rarity": "green",
      "shape": [
        "####"
      ],
      "weight": 1.08
    },
    {
      "id": "blue-weapon-extra",
      "rarity": "blue",
      "shape": [
        "#..",
        "#..",
        "###",
        "#.."
      ],
      "weight": 1.1
    },
    {
      "id": "purple-weapon-extra",
      "rarity": "purple",
      "shape": [
        "###",
        "#.#",
        "###"
      ],
      "weight": 1.06
    },
    {
      "id": "gold-weapon-extra",
      "rarity": "gold",
      "shape": [
        "####",
        "#...",
        "#...",
        "#...",
        "####"
      ],
      "weight": 1.05
    },
    {
      "id": "weapon-white-domino",
      "shape": [
        "##"
      ],
      "weight": 1.07,
      "rarity": "white"
    },
    {
      "id": "weapon-white-bar",
      "shape": [
        "###"
      ],
      "weight": 1.59,
      "rarity": "white"
    },
    {
      "id": "weapon-white-elbow",
      "shape": [
        "#.",
        "##"
      ],
      "weight": 1.61,
      "rarity": "white"
    },
    {
      "id": "white-notch",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6,
      "rarity": "white"
    },
    {
      "id": "weapon-green-hook",
      "shape": [
        "#..",
        "###"
      ],
      "weight": 1.07,
      "rarity": "green"
    },
    {
      "id": "weapon-green-zig",
      "shape": [
        ".##",
        "##."
      ],
      "weight": 1.09,
      "rarity": "green"
    },
    {
      "id": "weapon-green-cross",
      "shape": [
        ".#.",
        "###",
        ".#."
      ],
      "weight": 1.38,
      "rarity": "green"
    },
    {
      "id": "weapon-blue-fork",
      "shape": [
        "####",
        "#..#"
      ],
      "weight": 1.06,
      "rarity": "blue"
    },
    {
      "id": "weapon-blue-hook",
      "shape": [
        "#..",
        "##.",
        "###",
        "..#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "weapon-blue-guard",
      "shape": [
        "#.#",
        "###",
        "#.#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "weapon-purple-gate",
      "shape": [
        "#..#",
        "####",
        ".##."
      ],
      "weight": 1.06,
      "rarity": "purple"
    },
    {
      "id": "weapon-purple-river",
      "shape": [
        "##..",
        ".###",
        "..##",
        "...#"
      ],
      "weight": 1.07,
      "rarity": "purple"
    },
    {
      "id": "weapon-purple-claw",
      "shape": [
        "###.",
        "#..#",
        "####"
      ],
      "weight": 1.18,
      "rarity": "purple"
    },
    {
      "id": "weapon-gold-titan",
      "shape": [
        "###.#",
        "#.###",
        "###.."
      ],
      "weight": 1.05,
      "rarity": "gold"
    },
    {
      "id": "weapon-gold-e",
      "shape": [
        "###",
        "#..",
        "###",
        "#..",
        "###"
      ],
      "weight": 1.05,
      "rarity": "gold"
    },
    {
      "id": "weapon-gold-crown",
      "shape": [
        "##.##",
        ".###.",
        "#####"
      ],
      "weight": 1.13,
      "rarity": "gold"
    }
  ],
  "accessory": [
    {
      "id": "white-accessory-extra",
      "rarity": "white",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6
    },
    {
      "id": "green-accessory-extra",
      "rarity": "green",
      "shape": [
        "####"
      ],
      "weight": 1.08
    },
    {
      "id": "blue-accessory-extra",
      "rarity": "blue",
      "shape": [
        "#..",
        "#..",
        "###",
        "#.."
      ],
      "weight": 1.1
    },
    {
      "id": "purple-accessory-extra",
      "rarity": "purple",
      "shape": [
        "###",
        "#.#",
        "###"
      ],
      "weight": 1.06
    },
    {
      "id": "gold-accessory-extra",
      "rarity": "gold",
      "shape": [
        "####",
        "#...",
        "#...",
        "#...",
        "####"
      ],
      "weight": 1.05
    },
    {
      "id": "accessory-white-domino",
      "shape": [
        "##"
      ],
      "weight": 1.07,
      "rarity": "white"
    },
    {
      "id": "accessory-white-elbow",
      "shape": [
        "#.",
        "##"
      ],
      "weight": 1.61,
      "rarity": "white"
    },
    {
      "id": "accessory-white-bar",
      "shape": [
        "###"
      ],
      "weight": 1.59,
      "rarity": "white"
    },
    {
      "id": "white-notch",
      "shape": [
        "#..",
        "##."
      ],
      "weight": 1.6,
      "rarity": "white"
    },
    {
      "id": "accessory-green-tee",
      "shape": [
        "###",
        ".#."
      ],
      "weight": 1.08,
      "rarity": "green"
    },
    {
      "id": "accessory-green-zig",
      "shape": [
        ".##",
        "##."
      ],
      "weight": 1.09,
      "rarity": "green"
    },
    {
      "id": "accessory-green-cross",
      "shape": [
        ".#.",
        "###",
        ".#."
      ],
      "weight": 1.38,
      "rarity": "green"
    },
    {
      "id": "accessory-blue-stair",
      "shape": [
        "##.",
        ".##",
        ".##"
      ],
      "weight": 1.06,
      "rarity": "blue"
    },
    {
      "id": "accessory-blue-guard",
      "shape": [
        "#.#",
        "###",
        "#.#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "accessory-blue-hook",
      "shape": [
        "#..",
        "##.",
        "###",
        "..#"
      ],
      "weight": 1.24,
      "rarity": "blue"
    },
    {
      "id": "accessory-purple-river",
      "shape": [
        "##..",
        ".###",
        "..##",
        "...#"
      ],
      "weight": 1.07,
      "rarity": "purple"
    },
    {
      "id": "accessory-purple-bridge",
      "shape": [
        "##.##",
        ".###.",
        ".#.#."
      ],
      "weight": 1.19,
      "rarity": "purple"
    },
    {
      "id": "accessory-purple-step",
      "shape": [
        "###",
        ".##",
        "###"
      ],
      "weight": 1.04,
      "rarity": "purple"
    },
    {
      "id": "accessory-gold-star",
      "shape": [
        "..#..",
        ".###.",
        "#####",
        ".###.",
        "..#.."
      ],
      "weight": 1.23,
      "rarity": "gold"
    },
    {
      "id": "accessory-gold-crown",
      "shape": [
        "##.##",
        ".###.",
        "#####"
      ],
      "weight": 1.13,
      "rarity": "gold"
    },
    {
      "id": "accessory-gold-e",
      "shape": [
        "###",
        "#..",
        "###",
        "#..",
        "###"
      ],
      "weight": 1.05,
      "rarity": "gold"
    }
  ]
};
