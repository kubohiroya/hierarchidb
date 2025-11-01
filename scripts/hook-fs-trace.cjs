const fs = require('node:fs');
const path = require('node:path');
const logPath = path.resolve(process.cwd(), '.fs-trace.log');

function checkContent(content, target) {
  try {
    const str = typeof content === 'string' ? content : content.toString('utf8');
    const trimmed = str.trim();
    if (trimmed === 'this') {
      const resolved = typeof target === 'string' ? target : target?.toString?.() ?? '<unknown>';
      fs.appendFileSync(logPath, `${new Date().toISOString()} THIS ${resolved}\n`);
    }
  } catch (error) {
    // ignore
  }
}

const origReadFileSync = fs.readFileSync;
fs.readFileSync = function(...args) {
  const content = origReadFileSync.apply(this, args);
  checkContent(content, args[0]);
  return content;
};

const origReadFile = fs.readFile;
fs.readFile = function(...args) {
  const callback = args[args.length - 1];
  if (typeof callback === 'function') {
    args[args.length - 1] = function(err, data) {
      if (!err) checkContent(data, args[0]);
      callback(err, data);
    };
  }
  return origReadFile.apply(this, args);
};

if (fs.promises) {
  const origReadFilePromise = fs.promises.readFile.bind(fs.promises);
  fs.promises.readFile = async function(...args) {
    const data = await origReadFilePromise(...args);
    checkContent(data, args[0]);
    return data;
  };
}

module.exports = {};
