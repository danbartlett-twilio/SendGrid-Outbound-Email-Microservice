/**
 *  handle-sns-placeholder
 * 
 * Lambda function triggered by SNS message generated from the process-email-event
 * lambda or the send-email lambda.
 * 
 * This function is just placeholder to show how you could consume messages
 * and save them to databases and/or respond to errors.
 * 
 * Use the CloudWatch logs for this lambda to see the contents of SNS messages. * 
 * 
 */

export const lambdaHandler = async (event, context) => {
        
    /**
     * This just prints out the message object from SNS.
     * 
     * You could save these responses to a database, or trigger
     * alerts or different events if certain criteria are met.
     */
    console.log("sns object is => ", event?.Records[0]?.Sns);
            
};