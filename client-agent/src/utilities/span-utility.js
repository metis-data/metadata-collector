const os = require("os");
const { randomUUID: uuidv4 } = require('crypto');
const { version } = require('../package.json');
let resource;

function getResource() {
    if (resource) {
        return resource;
    }

    const vendor = "nodejs";

    // get host name
    let hostName = vendor;
    try {
        hostName = os.hostname();
    } catch (e) { }

    resource = {
        "service.name": hostName,
        "telemetry.sdk.name": vendor,
        "telemetry.sdk.version": version,
        "telemetry.sdk.language": vendor
    };

    return resource;
}

function makeSpan(csvItem) {
    let {
        message: { duration, query, plan, last_call: startTime },
        // TODO: ast and extract query op
        action = 'N/A',
        user,
        database,
        host,
    } = csvItem;

    const spanId = uuidv4();
    const traceId = uuidv4();

    duration = duration ?? ((plan && plan.Plan?.["Execution Time"]) || 1);

    return {
        parent_id: null,
        name: action,
        kind: "SpanKind.CLIENT",
        timestamp: Date.now(),
        duration: duration,
        start_time: startTime,
        end_time: new Date(new Date(startTime).getTime() + duration).toISOString(),
        attributes: {
            "db.name": database,
            "db.user": user,
            "db.system": "postgresql",
            "db.operation": action,
            "db.statement": query,
            "db.statement.metis": query,
            "db.statement.metis.plan": plan,
            "net.peer.name": host,
            "net.peer.ip": "unknown"
        },
        status: {
            status_code: "UNSET"
        },
        context: {
            span_id: spanId,
            trace_id: traceId
        },
        resource: getResource()
    };
}

module.exports = makeSpan