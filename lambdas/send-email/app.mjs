/**
 *  send-email
 * 
 * Lambda function triggered by createObject (JSON file) event in S3 SOURCE
 * bucket in the /requests prefix (folder). 
 * Lambda will get the json object, add a timestamp and then call the SendGrid API.
 * Responses from the API call can be saved to S3 and/or sent to SNS for 
 * additional processing.
 * 
 */

// Functions used in multiple lambdas saved to a layer for DRY
import { getJsonObjectFromS3, saveToS3, sendSNSMessage }  from '/opt/shared-functions.mjs';

// SendGrid Client (from Lambda Layer)
import mail from '@sendgrid/mail';

export const lambdaHandler = async (event, context) => {
    
    //console.log("event ==> ", event);
    
    // This lambda is triggered by a PUT event to the 
    // S3 bucket (matching request/ prefix and *.json). 
    // Set the bucket name and object key
    let bucket = event.Records[0].s3.bucket.name;
    let key = event.Records[0].s3.object.key;
    let fileName = key.replace("requests/","").replace(".json",""); // pull our just the file name (no prefix)
    
    try {

        // Get JSON Object from S3
        let sendObject = await getJsonObjectFromS3(event.Records[0]);

        //console.log ("In main handler sendObject is => ", sendObject);

        if (!sendObject) {
            
            // JSON SEND Object failed
            console.log("S3 Object JSON parse failed!");
            await sendSNSMessage(process.env.SNStopic, {sourceLambda:"SendEmailFunction",message:{message:"In send-email Lambda and JSON Parse Failed",event:event}});

        } else {
            
            // JSON SEND Object successfully retrieved...

            /**
             * This solution template assumes a single API Key. Many organizations
             * have multiple API Keys this is where you would enable business logic
             * to set or get correct API Key to use. 
             * 
             * In the process-email-event lambda, the custom argument apiKeyId is
             * set (customArgs.apiKeyId) so the API Key selection business logic would
             * be best set in that lambda. 
             * 
             * Based on the apiKeyId set, you could pull the correct API Key to use.
             * 
             * Best practice would be to use AWS Secrets Manager / Parameter Store to
             * pull in at run time the API KEY from the API KEY ID. There are methods
             * to cache parameters:
             * https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
             */
            let apiKey = process.env.SENDGRID_API_KEY;

            // SendGrid v3 Mail Send Documentation            
            // https://docs.sendgrid.com/api-reference/mail-send/mail-send

            // Set the SendGrid API Key
            mail.setApiKey(apiKey);

            // Add a timestamp to custom arguments right before 
            // making the api call to assist tracking latency
            if (!sendObject.hasOwnProperty('customArgs')) {
                sendObject.customArgs = {};
            }               
            sendObject.customArgs.apiCallTimestamp = Math.floor(Date.now()/1000);

            // Call SendGrid
            let response = await mail.send(sendObject);

            console.log("response ==> ", response);

            // Process response from SendGrid
            if (response) {
                
                /**
                 * Key variable from response object
                 */
                let statusCode = "none";
                let xMessageId = null;

                // S3 Object name to be saved
                let responseKey = null;
                
              
                // First Set Status Code                
                if (response[0] !== undefined && response[0].statusCode !== undefined) {
                    statusCode = response[0].statusCode.toString();    
                } else if (statusCode === 'none' && response.code !== undefined) {        
                    statusCode = response.code.toString();
                }
            
                // Change the key suffix to 'response' and add statusCode
                responseKey = `responses/${statusCode}/${fileName}.json`; 
            
                /**
                 * 
                 * All successful API Calls to this endpoint return a x-message-id
                 * parameter in the response headers. This x-message-id is included
                 * as the first part of the sg_message_id which is included in every
                 * email (it is the first set of chars before the first ".").
                 * 
                 * The sg_message_id is included in every webhook event which enables
                 * your system to tie every message event to its original request.
                 * 
                 * Note that if you are sending more than one email in a request,
                 * all emails will have the same 'x-message-id'.
                 * 
                 */
                
                if (response[0]?.statusCode !== undefined && response[0]?.statusCode === 202) {                    
                    /**
                     * Sucessful API Call
                     * 
                     * Pull out  the x-message-id in the response object as that
                     * will be tied to the Message-ID in the actual emails and the 
                     * sg_message_id included in all of the webhook events.
                     */
                                
                    if (response[0]?.headers['x-message-id'] !== undefined) {
                        // x-message-id can now be saved internally
                        xMessageId = response[0]?.headers['x-message-id'];                        
                        console.log("x-message-id => ", xMessageId);
            
                        // Include the x-message-id as part of the s3 object name in
                        // the response object saved to S3.
                        responseKey = `responses/${statusCode}/${fileName}__${xMessageId}.json`;             
                    }
                } 
            
                console.log("responseKey => ", responseKey);
                // console.log("bucket => ", bucket);
                    
                await saveToS3( responseKey, bucket, response);
            
                /*
                    You can conditionally handle if the status code is not 202.
                    For example, send to an SNS topic...
            
                    if (response[0]?.statusCode !== 202) {                    
                        console.log("Send SNS statusCode !== 202");
                        response.event = event;
                        await sendSNSMessage(response);
                    } 
                */
            
                // ...and/or you can send ALL response to SNS for 
                // additional processing                                
                
                await sendSNSMessage(process.env.SNStopic, {sourceLambda:"SendEmailFunction",requestId:sendObject?.customArgs?.requestId,xMessageId:xMessageId,message:response});

            }

        }

    } catch (err) {
        
        // Catch and log (S3 bucket and SNS message) any errors
        console.log("Error calling SendGrid API => ", err);                
        await saveToS3( key.replace('request',`responses/error`), bucket, err);
        await sendSNSMessage(process.env.SNStopic, {sourceLambda:"SendEmailFunction",message:err});

    }
};