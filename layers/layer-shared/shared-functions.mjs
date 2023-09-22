// S3 Client
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client( { region: process.env.REGION } );

// SNS Client
import  { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
const snsClient = new SNSClient({ region: process.env.REGION });

// This function gets an S3 object specified in the event record, returns JSON object
async function getJsonObjectFromS3(record) {

    let bucket = record.s3.bucket.name;
    let key = record.s3.object.key;

    //console.info("bucket => ",bucket);
    //console.info("key => ",key);
    
    let command = new GetObjectCommand({Bucket: bucket, Key: key});
    
    try {

        let data = await client.send(command);                
        let json = await data.Body.transformToString();        
        let parsed = JSON.parse(json);
        //console.info("parsed => ",parsed);
        return parsed;
    
    } catch (error) {

        console.log("Error getting JSON from S3! => ", error);

    }

}

// Save a json object to specific S3 key / bucket 
async function saveToS3( key, bucket, messageObj ) {

    let putObjectParams = {
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify( messageObj ),
        ContentType: 'application/json'
    };
    
    let command = new PutObjectCommand(putObjectParams);    
    
    try {
        
        let response = await client.send(command);
                
        //console.log("Success! response => ", response);

        return true;

    } catch (error) {

        console.log("Error adding json objet to requests folder! => ", error);

    }

}

// This function sends an SNS Message given a TOP and message payload
async function sendSNSMessage(topic, message) {
    
    let snsParams = {
        Message: JSON.stringify(message),
        TopicArn: topic
    };

    console.log("Publishing Message => ", message);
    console.log("to this SNS Topic => ", topic);
    
    await snsClient.send(new PublishCommand(snsParams));
    
    return;

}

export { getJsonObjectFromS3, saveToS3, sendSNSMessage }