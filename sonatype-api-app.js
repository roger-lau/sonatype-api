/*
 *  Created By: Roger L.
 *  Created Date: 1 Dec 2020
 *  Last Updated: 3 Dec 2020
 *  Purpose: To create/update/delete applications and manage their role access in Nexus IQ Server using APIs.
 *  Usage: node sonatype-api-app.js --u admin --p admin123 --serverURL http://localhost:8070 --orgName 'Department H' --appId 'app-1' --memberName 'roger.lau'
 */

// APIs
const ORG_API = "/api/v2/organizations";
const APP_API = "/api/v2/applications";
const GET_APP_INFO_API = "/api/v2/applications?publicId={appId}";
const UPDATE_ORG_API = "/api/v2/applications/{appInternalId}/move/organization/{orgId}";
const ASSIGN_MEMBER_API = "/api/v2/roleMemberships/organization/{orgId}/role/{roleId}/user/{memberName}";

// Allow self-signed TLS certificate in IQ Server (not recommended for production)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Handle http request
const request = require('superagent');

// Query json
const jp = require('jsonpath');

// Read input arguments
const args = require('yargs').argv;

const userName = args.u;
const password = args.p;
var serverURL = args.serverURL;
const orgName = args.orgName;
const appId = args.appId;
const memberName = args.memberName;

// Text Constants
const CONTENT_TYPE = "Content-Type";
const APPLICATION_JSON = "application/json";

// Configuration
const isDebug = false;

// Assign default server URL
if (isInputEmpty(serverURL)) serverURL = "http://localhost:8070";

// Check if arguments exist and not empty (it is TRUE value when argument is empty)
if (isInputEmpty(orgName) || isInputEmpty(appId) || isInputEmpty(userName) || isInputEmpty(password) || isInputEmpty(memberName)) {
    var errorMessage = "\n";
    if (isInputEmpty(orgName)) errorMessage += "Missing argument: --orgName\n";
    if (isInputEmpty(appId)) errorMessage += "Missing argument: --appId\n";
    if (isInputEmpty(userName)) errorMessage += "Missing argument: --u\n";
    if (isInputEmpty(password)) errorMessage += "Missing argument: --p\n";
    if (isInputEmpty(memberName)) errorMessage += "Missing argument: --memberName\n";

    exitWithError(errorMessage);
}

// Main
main();

// Main functions
function main() {
    // Get orgId from org
    const agent = request.agent();
    agent.get(serverURL + ORG_API).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
        .then(response => {
            const body = response.body;

            // Find orgId base on orgName
            const orgId = jp.query(body, '$..organizations[?(@.name=="' + orgName + '")].id').toString();

            if (isInputEmpty(orgId)) {
                // Create new organization
                const orgPayload = { "name": orgName };

                agent.post(serverURL + ORG_API).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
                    .send(orgPayload)
                    .then(response => {
                        console.log("New organization created.");
                        console.log(response.body);
                        const newOrgId = response.body.id;
                        assignMember(newOrgId, memberName);
                        createApp(newOrgId, appId);

                    }).catch(error => {
                        exitWithError(JSON.stringify(error, null, 2));
                    });
            } else {
                assignMember(orgId, memberName);
                createApp(orgId, appId);
            }

        }).catch(error => {
            exitWithError(JSON.stringify(error, null, 2));
        });;
}

function assignMember(orgId, memberName) {
    // Id of the owner role is always the same
    const ownerId = "1cddabf7fdaa47d6833454af10e0a3ef"; 


    request.put(serverURL + ASSIGN_MEMBER_API.replace("{orgId}", orgId).replace("{roleId}", ownerId).replace("{memberName}", memberName)).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
        .then(response => {
            const body = response.body;

        }).catch(error => {
            exitWithError(JSON.stringify(error, null, 2));
        });
}

function updateOrg(orgId, appId) {

    request.get(serverURL + GET_APP_INFO_API.replace("{appId}", appId)).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
        .then(response => {
            const body = response.body;

            // Find appInternalId
            const appInternalId = jp.query(body, '$..applications[0].id').toString();

            request.post(serverURL + UPDATE_ORG_API.replace("{orgId}", orgId).replace("{appInternalId}", appInternalId)).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
                .then(response => {
                    console.log("Application " + appId + " moved to " + orgName);
                    console.log(response.body);
                }).catch(error => {
                    exitWithError(JSON.stringify(error, null, 2));
                });

        }).catch(error => {
            exitWithError(JSON.stringify(error, null, 2));
        });

}

function createApp(orgId, appId) {
    const appPayload = {
        "publicId": appId,
        "name": appId,
        "organizationId": orgId
    };

    request.post(serverURL + APP_API).auth(userName, password).set(CONTENT_TYPE, APPLICATION_JSON)
        .send(appPayload)
        .then(response => {
            console.log("New application created.");
            console.log(response.body);
        }).catch(error => {
            updateOrg(orgId, appId);
            exitWithError(JSON.stringify(error, null, 2));
        });
}


// Utility functions
// Check if input argument is empty
function isInputEmpty(input) {
    return (input === undefined || input == "" || typeof (input) === "boolean");
}

function exitWithError(message) {
    if (isDebug) {
        // Print error message in red
        console.error('\x1b[31m%s\x1b[0m', message);
        // Exit with error code
        // process.exit(1);
    }
}
