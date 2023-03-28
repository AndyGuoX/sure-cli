const resolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')
const babel = require('@rollup/plugin-babel')
const { terser } = require('rollup-plugin-terser')
const cleanup = require('rollup-plugin-cleanup')

module.exports = [
  {
    input: './src/index.js',
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].js'
    },
    plugins: [
      // 解析node_modules中的依赖
      resolve(),
      // 将commonJS 模块转换为ES6模块
      commonjs(),
      // 使用babel转换ES6代码
      babel({ babelHelpers: 'bundled' }),
      // 压缩代码
      terser(),
      // 清除注释
      cleanup(),
      // 解析json文件
      json()
    ],
    external: id => {
      // 排除 node_modules 下的依赖
      return /^[\w-]+$/.test(id)
    }
  }
]