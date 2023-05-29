

class MessageUtility {
    constructor() { }

    /**
     * calculate buffer size
     * @param {Buffer} buff
     * @returns {number}
     */
    #calcSize(buffer) {
        return Buffer.byteLength(buffer);
    }

    /**
     * generate request headers
     * @param {Buffer} str
     * @returns {object}
     */
    #generateRequestHeaders(str = null) {
        return {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Content-Length': str ? String(this.calcSize(str)) : String(this.MAX_MSG_SIZE_KB * 1024),
            'x-api-key': this.apiKey,
        }
    }

    /**
     * 
     * @param {[string]} arr 
     * @param {number} messageSizeLimitInKb 
     * @returns 
     */
    static generateMessageArray(arr, messageSizeLimitInKb = 262) {
        try {
            const msgUtility = new MessageUtility();
            // NOTE: just for estimating the headers size - need to recalculate the content length per message later in the pipe
            const headers = msgUtility.#generateRequestHeaders();
            const headersSize = msgUtility.#calcSize(Buffer.from(JSON.stringify(headers)));

            const maxMsgSize = (messageSizeLimitInKb * 1024) - headersSize;
            const result = [];
            let currentSize = 0;
            let currentArray = [];

            for (let i = 0; i < arr.length; i++) {
                const str = arr[i];
                const strAsBuffer = Buffer.from(str);
                const strSize = Buffer.byteLength(strAsBuffer);

                if (currentSize + strSize > maxMsgSize) {
                    result.push(currentArray);
                    currentArray = [str];
                    currentSize = strSize;
                } else {
                    currentArray.push(str);
                    currentSize = Buffer.byteLength(Buffer.from(JSON.stringify(currentArray)));
                }
            }

            if (currentArray.length > 0) {
                result.push(currentArray);
            }

            return result;
        }
        catch (e) {
            throw e;
        }
    }
}

module.exports = MessageUtility;