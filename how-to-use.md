# How to use

`package.json` 的 `rgVersion` 字段为 <https://github.com/microsoft/ripgrep-prebuilt/releases> 的 tag 号。

`package.json` 的 `prebuiltVersion` 字段为 prebuilt 包的版本号。

```sh
yarn --ignore-scripts
node ./scripts/generatePreBuiltPkg.js

cd prebuilt
npm publish --access public
```

## 实现原理

1. 运行 `./scripts/generatePreBuiltPkg.js` 生成 `@opensumi/ripgrep-prebuilt` 包。
    在这一步会自动下载 <https://github.com/microsoft/ripgrep-prebuilt/releases> 中的编译好的 `ripgrep` 文件下载到 `./prebuilt/build/` 目录。
2. 在 `postinstall` 时下载 CDN 上的 `@opensumi/ripgrep-prebuilt` 对应平台的 `ripgrep` 并解压缩到 `./bin/` 目录
3. 通过 `rgPath` 拿到 `ripgrep` 即可执行

## 发包步骤

1. 执行 `npm install`。
2. 修改。
3. 修改 。
4. 首先发布 `@opensumi/ripgrep-prebuilt`。
   1. 执行 `node ./scripts/generatePreBuiltPkg.js`
   2. 打开到 `prebuilt` 目录，执行 `npm publish`。
5. 再回到当前的 `ripgrep` 目录，执行 `npm publish`。
