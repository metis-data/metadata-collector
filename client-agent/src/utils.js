const getPackageVersion = () => {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  // eslint-disable-next-line global-require
  return require('./package.json').version;
};

function relevant(timesADay, hour, minutes) {
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
function _isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
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

module.exports = {
  relevant,
  getPackageVersion,
  mergeDeep,
};
