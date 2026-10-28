three.js r160 (npm three@0.160.0, MIT License) を Web 版に同梱したもの。CDN からは読み込まない。
元: https://registry.npmjs.org/three/-/three-0.160.0.tgz （integrity sha512-DLU8lc0zNIPkM7rH5/e1Ks1Z8tWCGRq6g8mPowdDJpw1CFBJMU7UoJjC6PefXW7z//SSl0b2+GCw14LB+uDhng==）
含むもの: build/three.module.min.js、examples/jsm/controls/OrbitControls.js、examples/jsm/renderers/CSS2DRenderer.js（中身は無改変）、LICENSE
版を上げるときは、この3ファイルを同じ版で入れ替え、scripts/build_web.py の THREE_VERSION と一緒に直す。
