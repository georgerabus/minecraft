/* 
 * 
 *          noa hello-world example with Perlin Noise
 * 
 *  This is a bare-minimum example world with Perlin noise terrain generation,
 *  intended to be a starting point for hacking on noa game world content.
 * 
*/



// Engine options object, and engine instantiation.
import { Engine } from 'noa-engine'


var opts = {
    debug: true,
    showFPS: true,
    chunkSize: 32,
    chunkAddDistance: 2.5,
    chunkRemoveDistance: 3.5,
    // See `test` example, or noa docs/source, for more options
}
var noa = new Engine(opts)



/*
 *
 *      Perlin Noise Implementation
 * 
 *  Simple Perlin noise implementation for terrain generation
 * 
*/

class PerlinNoise {
    constructor(seed = 0) {
        this.p = []
        this.permutation = []
        
        // Generate permutation table
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i
        }
        
        // Shuffle permutation table based on seed
        this.shuffle(this.permutation, seed)
        
        // Duplicate permutation table
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i % 256]
        }
    }
    
    shuffle(array, seed) {
        let random = this.seededRandom(seed)
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]
        }
    }
    
    seededRandom(seed) {
        let x = Math.sin(seed) * 10000
        return function() {
            x = Math.sin(x) * 10000
            return x - Math.floor(x)
        }
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10)
    }
    
    lerp(a, b, t) {
        return a + t * (b - a)
    }
    
    grad(hash, x, y, z) {
        const h = hash & 15
        const u = h < 8 ? x : y
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    }
    
    noise(x, y, z) {
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255
        const Z = Math.floor(z) & 255
        
        x -= Math.floor(x)
        y -= Math.floor(y)
        z -= Math.floor(z)
        
        const u = this.fade(x)
        const v = this.fade(y)
        const w = this.fade(z)
        
        const A = this.p[X] + Y
        const AA = this.p[A] + Z
        const AB = this.p[A + 1] + Z
        const B = this.p[X + 1] + Y
        const BA = this.p[B] + Z
        const BB = this.p[B + 1] + Z
        
        return this.lerp(
            this.lerp(
                this.lerp(
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x - 1, y, z),
                    u
                ),
                this.lerp(
                    this.grad(this.p[AB], x, y - 1, z),
                    this.grad(this.p[BB], x - 1, y - 1, z),
                    u
                ),
                v
            ),
            this.lerp(
                this.lerp(
                    this.grad(this.p[AA + 1], x, y, z - 1),
                    this.grad(this.p[BA + 1], x - 1, y, z - 1),
                    u
                ),
                this.lerp(
                    this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1),
                    u
                ),
                v
            ),
            w
        )
    }
    
    // Fractal Brownian Motion for more natural terrain
    fbm(x, y, z, octaves = 4, persistence = 0.5, scale = 0.1) {
        let value = 0
        let amplitude = 1
        let frequency = scale
        let maxValue = 0
        
        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency, z * frequency) * amplitude
            maxValue += amplitude
            amplitude *= persistence
            frequency *= 2
        }
        
        return value / maxValue
    }
}

// Create Perlin noise instance
const perlin = new PerlinNoise(12345) // You can change the seed for different worlds



/*
 *
 *      Registering voxel types
 * 
 *  Two step process. First you register a material, specifying the 
 *  color/texture/etc. of a given block face, then you register a 
 *  block, which specifies the materials for a given block type.
 * 
*/

// block materials (just colors for this demo)
var brownish = [0.45, 0.36, 0.22]
var greenish = [0.1, 0.8, 0.2]
var grayish = [0.5, 0.5, 0.5]
var darkBrown = [0.3, 0.2, 0.1]

noa.registry.registerMaterial('dirt', { color: brownish })
noa.registry.registerMaterial('grass', { color: greenish })
noa.registry.registerMaterial('stone', { color: grayish })
noa.registry.registerMaterial('bedrock', { color: darkBrown })


// block types and their material names
var dirtID = noa.registry.registerBlock(1, { material: 'dirt' })
var grassID = noa.registry.registerBlock(2, { material: 'grass' })
var stoneID = noa.registry.registerBlock(3, { material: 'stone' })
var bedrockID = noa.registry.registerBlock(4, { material: 'bedrock' })




/*
 * 
 *      World generation with Perlin Noise
 * 
 *  The world is divided into chunks, and `noa` will emit an 
 *  `worldDataNeeded` event for each chunk of data it needs.
 *  The game client should catch this, and call 
 *  `noa.world.setChunkData` whenever the world data is ready.
 *  (The latter can be done asynchronously.)
 * 
*/

// Enhanced terrain generation with Perlin noise
function getVoxelID(x, y, z) {
    // Bedrock layer at the bottom
    if (y < -15) return bedrockID
    
    // Use Perlin noise for height map
    const heightNoise = perlin.fbm(x, 0, z, 4, 0.5, 0.02)
    const terrainHeight = Math.floor(heightNoise * 15) // Scale height variation
    
    // Cave generation using 3D Perlin noise
    const caveNoise = perlin.fbm(x, y, z, 3, 0.6, 0.05)
    const isCave = caveNoise > 0.3 && y > -10 && y < terrainHeight - 2
    
    // Stone layer generation
    const stoneNoise = perlin.fbm(x, y, z, 2, 0.4, 0.03)
    const stoneThreshold = 0.1
    
    if (y < terrainHeight) {
        if (isCave) return 0 // Empty space for caves
        
        // Surface layer - grass
        if (y >= terrainHeight - 1) return grassID
        
        // Sub-surface layers
        if (y >= terrainHeight - 4) return dirtID
        
        // Stone layers with some variation
        if (stoneNoise > stoneThreshold) return stoneID
        
        return dirtID
    }
    
    return 0 // Air/empty space
}

// register for world events
noa.world.on('worldDataNeeded', function (id, data, x, y, z) {
    // `id` - a unique string id for the chunk
    // `data` - an `ndarray` of voxel ID data (see: https://github.com/scijs/ndarray)
    // `x, y, z` - world coords of the corner of the chunk
    for (var i = 0; i < data.shape[0]; i++) {
        for (var j = 0; j < data.shape[1]; j++) {
            for (var k = 0; k < data.shape[2]; k++) {
                var voxelID = getVoxelID(x + i, y + j, z + k)
                data.set(i, j, k, voxelID)
            }
        }
    }
    // tell noa the chunk's terrain data is now set
    noa.world.setChunkData(id, data)
})




/*
 * 
 *      Create a mesh to represent the player:
 * 
*/

// get the player entity's ID and other info (position, size, ..)
var player = noa.playerEntity
var dat = noa.entities.getPositionData(player)
var w = dat.width
var h = dat.height

// add a mesh to represent the player, and scale it, etc.
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'

var scene = noa.rendering.getScene()
var mesh = CreateBox('player-mesh', {}, scene)
mesh.scaling.x = w
mesh.scaling.z = w
mesh.scaling.y = h

// this adds a default flat material, without specularity
mesh.material = noa.rendering.makeStandardMaterial()


// add "mesh" component to the player entity
// this causes the mesh to move around in sync with the player entity
noa.entities.addComponent(player, noa.entities.names.mesh, {
    mesh: mesh,
    // offset vector is needed because noa positions are always the 
    // bottom-center of the entity, and Babylon's CreateBox gives a 
    // mesh registered at the center of the box
    offset: [0, h / 2, 0],
})


/*
 * 
 *      Enhanced interactivity 
 * 
*/

// clear targeted block on on left click
noa.inputs.down.on('fire', function () {
    if (noa.targetedBlock) {
        var pos = noa.targetedBlock.position
        noa.setBlock(0, pos[0], pos[1], pos[2])
    }
})

// place some grass on right click
noa.inputs.down.on('alt-fire', function () {
    if (noa.targetedBlock) {
        var pos = noa.targetedBlock.adjacent
        noa.setBlock(grassID, pos[0], pos[1], pos[2])
    }
})

// add a key binding for "E" to do the same as alt-fire
noa.inputs.bind('alt-fire', 'KeyE')

// Add key bindings for placing different block types
noa.inputs.bind('place-dirt', 'Digit1')
noa.inputs.bind('place-stone', 'Digit2')
noa.inputs.bind('place-grass', 'Digit3')

var currentBlockType = grassID

noa.inputs.down.on('place-dirt', function() {
    currentBlockType = dirtID
    console.log('Selected: Dirt')
})

noa.inputs.down.on('place-stone', function() {
    currentBlockType = stoneID
    console.log('Selected: Stone')
})

noa.inputs.down.on('place-grass', function() {
    currentBlockType = grassID
    console.log('Selected: Grass')
})

// Update alt-fire to use current block type
noa.inputs.down.off('alt-fire') // Remove previous handler
noa.inputs.down.on('alt-fire', function () {
    if (noa.targetedBlock) {
        var pos = noa.targetedBlock.adjacent
        noa.setBlock(currentBlockType, pos[0], pos[1], pos[2])
    }
})


// each tick, consume any scroll events and use them to zoom camera
noa.on('tick', function (dt) {
    var scroll = noa.inputs.pointerState.scrolly
    if (scroll !== 0) {
        noa.camera.zoomDistance += (scroll > 0) ? 1 : -1
        if (noa.camera.zoomDistance < 0) noa.camera.zoomDistance = 0
        if (noa.camera.zoomDistance > 10) noa.camera.zoomDistance = 10
    }
})