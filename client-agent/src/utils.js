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

module.exports = {
  relevant,
  getPackageVersion,
};
