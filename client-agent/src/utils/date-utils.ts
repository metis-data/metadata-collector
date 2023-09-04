export default class DateUtils {
  static roundToNearestHour(date: number): Date {
      try {
          const newDate = new Date(date);
          if (!(newDate instanceof Date)) {
              throw 'INVALID_DATE';
          }
          newDate.setMinutes(newDate.getMinutes() - 30);
          newDate.setMinutes(0, 0, 0);
          return newDate;
      }
      catch (e) {
          throw e;
      }
  }
}

export const roundToNearestHour = (date: number): Date => {
  try {
      const newDate = new Date(date);
      if (!(newDate instanceof Date)) {
          throw 'INVALID_DATE';
      }
      newDate.setMinutes(newDate.getMinutes() - 30);
      newDate.setMinutes(0, 0, 0);
      return newDate;
  }
  catch (e) {
      throw e;
  }
}

