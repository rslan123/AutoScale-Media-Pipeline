import axios from 'axios';

const API_ENDPOINT = "https://abpv6fyl5m.execute-api.eu-central-1.amazonaws.com/default/getPresignedImgURL";
const OPTIMIZED_BUCKET_BASE = "https://autoscaler-optimized-images-202512252014.s3.eu-central-1.amazonaws.com";

export const uploadAndProcessImage = async (file, email, role, quality, keepOriginal) => {
    // 1. Get Pre-signed URL with options included in params
    const response = await axios.get(API_ENDPOINT, {
        params: {
            email: email,
            role: role,
            quality: quality,          // Pass quality
            keepOriginal: keepOriginal // Pass toggle
        }
    });
    
    const responseData = typeof response.data.body === 'string' 
        ? JSON.parse(response.data.body) 
        : response.data;

    const { uploadURL, Key } = responseData;
    const fileBaseName = Key.split('.')[0];

    // 2. Upload to S3 (Metadata is handled by the Node Lambda based on params above)
    await axios.put(uploadURL, file, {
        headers: { "Content-Type": file.type }
    });

    return {
        originalKey: Key,
        thumbnail: `${OPTIMIZED_BUCKET_BASE}/thumbnails/${fileBaseName}.webp`,
        medium: `${OPTIMIZED_BUCKET_BASE}/medium/${fileBaseName}.webp`,
        large: `${OPTIMIZED_BUCKET_BASE}/large/${fileBaseName}.webp`,
        original: `${OPTIMIZED_BUCKET_BASE}/original_res/${fileBaseName}.webp`
    };
};
export const fetchImageMetadata = async (key) => {
  try {
    const response = await axios.get(`${API_ENDPOINT}?action=getMetadata&key=${key}`);
    const data = typeof response.data.body === 'string' 
        ? JSON.parse(response.data.body) 
        : response.data;
    return data; 
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return null;
  }
};

// NEW FUNCTION: Fetches everything for the Admin
export const fetchAllLogs = async () => {
  try {
    const response = await axios.get(API_ENDPOINT, {
        params: { action: 'getAllMetadata' }
    });
    
    // API Gateway returns an object with a 'body' property. 
    // We need to parse that 'body' string into a real Array.
    let data;
    if (response.data && response.data.body) {
        data = typeof response.data.body === 'string' 
            ? JSON.parse(response.data.body) 
            : response.data.body;
    } else {
        // If there is no .body, the Lambda might be returning the array directly
        data = response.data;
    }
        
    return Array.isArray(data) ? data : []; 
  } catch (error) {
    console.error("Error fetching all logs:", error);
    return [];
  }
};