// 渲染库打包入口：把 three + 3d-force-graph 打成单文件自包含 IIFE，挂到 window。
// 用 esbuild 打包(自动去重→单个 three 实例)，产物 scripts/vendor-libs.iife.js 被 gen-bloodline.js 内联进 HTML。
// 目的：去掉 esm.sh / esm.run 等海外 CDN 运行时依赖 → 站点哪能打开就哪能渲染(大陆友好)。
// 重建命令：node_modules/.bin/esbuild scripts/_libs-entry.js --bundle --minify --format=iife --outfile=scripts/vendor-libs.iife.js
import * as THREE from "three";
import ForceGraph3D from "3d-force-graph";
window.THREE = THREE;
window.ForceGraph3D = ForceGraph3D;
