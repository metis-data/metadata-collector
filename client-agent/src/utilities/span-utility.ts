import os = require("os");
import { randomUUID as uuidv4 } from 'crypto';
// @ts-ignore
import { version } from './../../package.json';
let resource: any;

function getResource() {
    if (resource) {
        return resource;
    }

    const vendor = "pg_store_plans";

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

function makeSpan(csvItem: any) {
    let {
        message: { query, plan, last_call: startTime, duration: _duration, query_id: queryId },
        // TODO: ast and extract query op
        action = 'N/A',
        user,
        database,
        host,
    } = csvItem;

    const spanId = uuidv4();
    const traceId = uuidv4();
    let duration;
    try {
        duration = Math.ceil(JSON.parse(plan).Plan?.['Execution Time'] || _duration);
    }
    catch (e) {
        duration = Math.ceil(_duration);
    }

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
            "net.peer.ip": "unknown",
            "db.query.id": queryId
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

export default makeSpan;