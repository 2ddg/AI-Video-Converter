// 从 build/icon.png 生成 build/icon.ico（PNG-embedded ICO，Vista+ 支持）
// 规避 electron-builder icons-bundle wasm 内存分配失败
const fs = require('fs')
const path = require('path')

const pngPath = path.join(__dirname, 'build', 'icon.png')
const icoPath = path.join(__dirname, 'build', 'icon.ico')

const png = fs.readFileSync(pngPath)

// ICO 文件头 (6 bytes) + 1 个目录项 (16 bytes) + PNG 数据
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type = 1 (icon)
header.writeUInt16LE(1, 4) // count = 1 image

const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0) // width 256 (0 表示 256)
entry.writeUInt8(0, 1) // height 256
entry.writeUInt8(0, 2) // color count (0)
entry.writeUInt8(0, 3) // reserved
entry.writeUInt16LE(1, 4) // planes
entry.writeUInt16LE(32, 6) // bit count
entry.writeUInt32LE(png.length, 8) // bytes in resource
entry.writeUInt32LE(6 + 16, 12) // image offset (header + 1 entry)

const ico = Buffer.concat([header, entry, png])
fs.writeFileSync(icoPath, ico)
console.log('icon.ico generated:', icoPath, ico.length, 'bytes')
