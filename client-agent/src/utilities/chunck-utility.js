
// export async function post(url, data, options) {
//     const parsedUrl = new URL(url);
//     let http;
//     if (parsedUrl.protocol === 'https:') {
//         http = require('https')
//     } else {
//         http = require('http')
//     }
//     return new Promise((resolve, reject) => {
//         const req = http.request(url, options, (res) => {
//             if (res.statusCode < 200 || res.statusCode > 299) {
//                 return reject({
//                     statusCode: res.statusCode,
//                     message: `HTTP status code ${res.statusCode}`,
//                 });
//             }

//             const body = [];
//             res.on("data", (chunk) => body.push(chunk));
//             res.on("end", () => {
//                 const resString = Buffer.concat(body).toString();
//                 resolve(resString);
//             });
//         });

//         req.on("error", (err) => {
//             reject(err);
//         });

//         req.on("timeout", () => {
//             req.destroy();
//             reject(new Error("Request time out"));
//         });

//         req.write(data);
//         req.end();
//     });
// }

function* chuncker(data, limit = 200000) {
    if (!data) {
        return [];
    }

    let result = [];
    let counter = 0;
    for (const item of data) {
        counter += item.length;
        result.push(item);
        if (counter >= limit) {
            yield result;
            counter = 0;
            result = []; // start a new chunk
        }
    }

    yield result;
}

module.exports = chuncker;