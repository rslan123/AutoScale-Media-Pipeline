import json
import boto3
import os
import uuid
import time
from io import BytesIO
from PIL import Image
from decimal import Decimal

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ImageMetadata')

DEST_BUCKET = "autoscaler-optimized-images-202512252014"

# We keep the responsive sizes 
SIZES = {
    'thumbnails': (150, 150),
    'medium': (800, 800),
    'large': (1920, 1920)
}

def lambda_handler(event, context):
    start_time = time.time()
    
    try:
        source_bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        # --- 1. GET METADATA OPTIONS FROM REACT ---
        head = s3.head_object(Bucket=source_bucket, Key=key)
        metadata = head.get('Metadata', {})
        
        user_id = metadata.get('userid', 'anonymous_user')
        user_role = metadata.get('userrole', 'guest')
        
        # Get custom compression (0-100) or default to 80
        custom_quality = int(metadata.get('quality', 80))
        
        # Check if user wants a 1:1 original size conversion
        keep_original_res = metadata.get('keep-original', 'false').lower() == 'true'

        # --- 2. PROCESS IMAGE ---
        response = s3.get_object(Bucket=source_bucket, Key=key)
        original_data = response['Body'].read()
        original_size = len(original_data)
        
        total_output_size = 0
        file_id = key.split('.')[0]

        with Image.open(BytesIO(original_data)) as img:
            # Handle PNG/RGBA transparency (convert to RGB for WebP)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # OPTION A: Create the 3 standard responsive sizes
            for size_name, dimensions in SIZES.items():
                temp_img = img.copy()
                temp_img.thumbnail(dimensions)
                
                buf = BytesIO()
                temp_img.save(buf, format='WEBP', quality=custom_quality)
                output_bytes = buf.getvalue()
                
                total_output_size += len(output_bytes)
                s3.put_object(
                    Bucket=DEST_BUCKET,
                    Key=f"{size_name}/{file_id}.webp",
                    Body=output_bytes,
                    ContentType='image/webp'
                )

            # OPTION B: NEW - 1:1 Original Resolution Conversion
            if keep_original_res:
                buf_orig = BytesIO()
                img.save(buf_orig, format='WEBP', quality=custom_quality)
                orig_optimized = buf_orig.getvalue()
                total_output_size += len(orig_optimized)
                
                s3.put_object(
                    Bucket=DEST_BUCKET,
                    Key=f"original_res/{file_id}.webp",
                    Body=orig_optimized,
                    ContentType='image/webp'
                )

        # --- 3. LOG TO DYNAMODB ---
        savings = Decimal(str(round(((original_size - total_output_size) / original_size) * 100, 2)))
        duration = Decimal(str(round((time.time() - start_time) * 1000, 2)))
        
        table.put_item(
            Item={
                'image_id': str(uuid.uuid4()),
                'user_id': user_id,
                'user_role': user_role,
                'file_name': key,
                'quality_used': custom_quality,
                'original_size_kb': Decimal(str(round(original_size / 1024, 2))),
                'total_output_kb': Decimal(str(round(total_output_size / 1024, 2))),
                'savings_percent': f"{savings}%",
                'processing_time_ms': duration,
                'timestamp': Decimal(str(time.time()))
            }
        )

    except Exception as e:
        print(f"ERROR: {str(e)}")
        raise e

    return {'statusCode': 200}