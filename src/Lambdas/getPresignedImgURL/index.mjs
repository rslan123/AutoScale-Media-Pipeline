import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({ region: "eu-central-1" });
const dbClient = new DynamoDBClient({ region: "eu-central-1" });
const docClient = DynamoDBDocumentClient.from(dbClient);

export const handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    const params = event.queryStringParameters || {};
    const action = params.action;

    // --- 1. ADMIN ACTION: FETCH ALL LOGS ---
    if (action === 'getAllMetadata') {
        const result = await docClient.send(new ScanCommand({
            TableName: "ImageMetadata"
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(Array.isArray(result.Items) ? result.Items : [])
        };
    }

    // --- 2. FETCH SPECIFIC IMAGE METADATA ---
    if (action === 'getMetadata') {
        const fileName = params.key;
        const result = await docClient.send(new QueryCommand({
            TableName: "ImageMetadata",
            IndexName: "file_name", 
            KeyConditionExpression: "file_name = :fn",
            ExpressionAttributeValues: { ":fn": fileName }
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Items[0] || {})
        };
    }

    // --- 3. DEFAULT: GENERATE UPLOAD URL WITH CUSTOM OPTIONS ---
    // Capture user identity and new optimization parameters
    const userEmail = params.email || 'anonymous_user';
    const userRole = params.role || 'guest';
    const quality = params.quality || '80';
    const keepOriginal = params.keepOriginal || 'false';

    // Generate a unique key. 
    const randomID = parseInt(Math.random() * 10000000);
    const Key = `upload_${randomID}`; 

    const command = new PutObjectCommand({
        Bucket: "autoscaler-raw-images-202512252012",
        Key: Key,
        // The metadata is the "message" we send to the Python Lambda
        Metadata: {
            'userid': userEmail,
            'userrole': userRole,
            'quality': quality.toString(),
            'keep-original': keepOriginal.toString()
        }
    });

    const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ uploadURL, Key })
    };
};