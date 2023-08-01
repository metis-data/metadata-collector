const connectionParser = require('connection-string-parser');

const getPackageVersion = () => {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  // eslint-disable-next-line global-require
  return require('./package.json').version;
};

function relevant(timesADay: any, hour: any, minutes: any) {
  const floatTimesADay = parseFloat(timesADay);
  if (!floatTimesADay || floatTimesADay < 0) {
    return false;
  }
  const every = Math.round(24 / floatTimesADay);
  return hour % every === 0 || (minutes === 0 && ((hour + 23) % 24) % every === 0);
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function _isObject(item: any) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target: any, ...sources: any): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (_isObject(target) && _isObject(source)) {
    for (const key in source) {
      if (_isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

const isEmpty = (objectName: any) => {
  for (let prop in objectName) {
    if (objectName.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
};


export  {
  isEmpty,
  relevant,
  getPackageVersion,
  mergeDeep,
};
