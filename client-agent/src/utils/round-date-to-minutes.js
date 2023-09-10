


function roundTimestampToMinute(timestamp) {

  // Calculate the number of milliseconds to round off
  const millisecondsToRound = timestamp % (60 * 1000);

  // Round the timestamp by subtracting the milliseconds to round off
  const roundedTimestamp = timestamp - millisecondsToRound;

  // Create a new Date object with the rounded timestamp
  const roundedDate = new Date(roundedTimestamp);

  return roundedDate;
}


module.exports =  roundTimestampToMinute ;