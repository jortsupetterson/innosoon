// build.js
const fs = require('fs/promises');
const path = require('path');
const esbuild = require('esbuild');
const { minify } = require('html-minifier-terser');
const glob = require('glob');

(async function(){
  const srcRoot = path.resolve(__dirname, 'src_assets');
  const outRoot = path.resolve(__dirname, 'ASSETS');
  await fs.mkdir(outRoot, { recursive: true });
  const files = glob.sync('**/*.*', { cwd: srcRoot, nodir: true });
  for(const rel of files){
    const src = path.join(srcRoot, rel);
    const dst = path.join(outRoot, rel);
    const ext = path.extname(rel).toLowerCase();
    await fs.mkdir(path.dirname(dst), { recursive: true });
    const contents = await fs.readFile(src, 'utf8');
    if(ext === '.js'){
      const { code } = await esbuild.transform(contents, { loader: 'js', minify: true });
      await fs.writeFile(dst, code, 'utf8');
    } else if(ext === '.css'){
      const { code } = await esbuild.transform(contents, { loader: 'css', minify: true });
      await fs.writeFile(dst, code, 'utf8');
    } else if(ext === '.html' || ext === '.htm'){
      const result = await minify(contents, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true
      });
      await fs.writeFile(dst, result, 'utf8');
    } else if(ext === '.json'){
      const obj = JSON.parse(contents);
      const min = JSON.stringify(obj);
      await fs.writeFile(dst, min, 'utf8');
    } else {
      await fs.copyFile(src, dst);
    }
  }
})();
