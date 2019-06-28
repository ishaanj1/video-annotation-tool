import json
import numpy as np
import pandas as pd
import cv2
import copy
import os
import boto3
from dotenv import load_dotenv
from loading_data import queryDB
from psycopg2 import connect
import predict

config_path = '../config.json'
with open(config_path) as config_buffer:
   config = json.loads(config_buffer.read())['ml']

good_users = config['biologist_users']
EVALUATION_IOU_THRESH = config['evaluation_iou_threshold']
RESIZED_WIDTH = config['resized_video_width']
RESIZED_HEIGHT = config['resized_video_height']
weights_path = config['weights_path']

AWS_S3_BUCKET_AIVIDEOS_FOLDER = os.getenv("AWS_S3_BUCKET_AIVIDEOS_FOLDER")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET = os.getenv('AWS_S3_BUCKET_NAME')
s3 = boto3.client('s3', aws_access_key_id = AWS_ACCESS_KEY_ID, aws_secret_access_key = AWS_SECRET_ACCESS_KEY)
S3_WEIGHTS_FOLDER = os.getenv("AWS_S3_BUCKET_WEIGHTS_FOLDER")

# connect to db
con = connect(database=os.getenv("DB_NAME"), 
    host=os.getenv("DB_HOST"), 
    user=os.getenv("DB_USER"), 
    password=os.getenv("DB_PASSWORD"))
cursor = con.cursor()

def score_predictions(validation, predictions, iou_thresh, concepts):
    # Maintain a set of predicted objects to verify
    detected_objects = []
    obj_map = predictions.groupby('objectid', sort=False).conceptid.max()
    
    # group predictions by video frames
    predictions = predictions.groupby('frame_num', sort=False)
    predictions = [df for _, df in predictions]
    
    # mapping frames to predictions index
    frame_data = {}
    for i, group in enumerate(predictions):
        frame_num = group.iloc[0]['frame_num']
        frame_data[frame_num] = i
    
    # group validation annotations by frames
    validation = validation.apply(resize, axis=1)
    validation = validation.groupby('frame_num', sort=False)
    validation = [df for _, df in validation]
    
    # initialize counters for each concept
    true_positives = dict(zip(concepts,[0] * len(concepts)))
    false_positives = dict(zip(concepts,[0] * len(concepts)))
    false_negatives = dict(zip(concepts,[0] * len(concepts)))
    
    # get true and false positives for each frame of validation data
    for group in validation:
        try: # get corresponding predictions for this frame
            frame_num = group.iloc[0]['frame_num']
            predicted = predictions[frame_data[frame_num]]
        except:
            continue # False Negatives already covered
            
        detected_truths = dict(zip(concepts, [0] * len(concepts)))
        for index, truth in group.iterrows():
            for index, prediction in predicted.iterrows():
                if (prediction.conceptid == truth.conceptid
                        and predict.compute_IOU(truth, prediction) > iou_thresh
                        and prediction.objectid not in detected_objects):
                    detected_objects.append(prediction.objectid)
                    true_positives[prediction.conceptid] += 1
                    detected_truths[prediction.conceptid] += 1
                    
        # False Negatives (Missed ground truth predicitions)
        counts = group.conceptid.value_counts()
        for concept in concepts:
            count = counts[concept] if (concept in counts.index) else 0
            false_negatives[concept] += count - detected_truths[concept]
    
    # False Positives (No ground truth prediction at any frame for that object)
    undetected_objects = set(obj_map.index) - set(detected_objects)
    for obj in undetected_objects:
        concept = obj_map[obj]
        false_positives[concept] += 1
    
    metrics = pd.DataFrame()
    for concept in concepts:
        TP = true_positives[concept]
        FP = false_positives[concept]
        FN = false_negatives[concept]
        precision = TP / (TP + FP) if (TP + FP) != 0 else 0
        recall = TP / (TP + FN) if (TP + FN) != 0 else 0
        f1 = (2*recall*precision / (precision+recall)) if (precision+recall) != 0 else 0
        metrics = metrics.append([[concept, TP, FP, FN, precision, recall, f1]])
    metrics.columns = ['conceptid', 'TP', 'FP', 'FN', 'Precision', 'Recall', 'F1']
    return metrics


def resize(row):
    new_width = RESIZED_WIDTH
    new_height = RESIZED_HEIGHT
    row.x1 = (row.x1 * new_width) / row.videowidth
    row.x2 = (row.x2 * new_width) / row.videowidth
    row.y1 = (row.y1 * new_height) / row.videoheight
    row.y2 = (row.y2 * new_height) / row.videoheight
    row.videowidth = new_width
    row.videoheight = new_height
    return row

def get_counts(results, annotations):
    grouped = results.groupby(['objectid']).label.mean().reset_index()
    counts = grouped.groupby('label').count()
    counts.columns = ['pred_num']
    groundtruth_counts = pd.DataFrame(annotations.groupby('conceptid').id.count())
    groundtruth_counts.columns = ['true_num']
    counts = pd.concat((counts, groundtruth_counts), axis=1, join='outer').fillna(0)
    counts['count_accuracy'] = 1 - abs(counts.true_num - counts.pred_num) / counts.true_num
    return counts

def interlace_annotations_to_video(annotations, filename, concepts):
    vid = cv2.VideoCapture(filename)
    fps = vid.get(cv2.CAP_PROP_FPS)
    while not vid.isOpened():
       continue

    frames = []
    check = True
    while True:
       check, frame = vid.read()
       if not check:
          break
       frame = cv2.resize(frame, (RESIZED_WIDTH, RESIZED_HEIGHT))
       frames.append(frame)
    vid.release()

    validation = annotations.apply(resize, axis=1)
    for val in validation.itertuples():
        if val.conceptid in concepts and val.frame_num < len(frames):
            x1, y1, x2, y2 = int(val.x1), int(val.y1), int(val.x2), int(val.y2)
            cv2.rectangle(frames[val.frame_num], (x1, y1), (x2, y2), (0, 0, 255), 3)
            cv2.putText(frames[val.frame_num], str(val.conceptid), (x1, y1+15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    predict.save_video(filename, frames, fps)
    converted_file = 'testing.mp4'
    os.system('ffmpeg -loglevel 0 -i \'' + filename + '\' -codec:v libx264 -y \''+ converted_file + '\'')
    #upload video..
    s3.upload_file(converted_file, S3_BUCKET, AWS_S3_BUCKET_AIVIDEOS_FOLDER +  filename,  ExtraArgs={'ContentType':'video/mp4'})
    os.system('rm \'' + filename + '\'')

    # add the entry to ai_videos
    cursor.execute('''
        INSERT INTO ai_videos (name)
        VALUES (%s)''',
        (filename,)
    )


# s3.upload_file(temp_file, S3_BUCKET, S3_ANNOTATION_FOLDER + no_box, ExtraArgs={'ContentType':'image/png'}) 

def evaluate(video_id, model_username, concepts):
    # file format: (video_id)_(model_name)-(ctime).mp4
    filename = str(video_id) + '_' + model_username + '.mp4'
    results, fps = predict.predict_on_video(video_id, weights_path, concepts, filename)
    print("done predicting")

    annotations = queryDB('select * from annotations where videoid= ' + str(video_id) 
        + ' and userid in ' + str(tuple(good_users)) +' and userid not in (32, 29)') # 32 is tracking ai, 29 is retinet ai
    annotations['frame_num'] = np.rint(annotations['timeinvideo'] * fps).astype(int)

    metrics = score_predictions(annotations, results, EVALUATION_IOU_THRESH, concepts)
    interlace_annotations_to_video(copy.deepcopy(annotations), filename, concepts)
    concept_counts = get_counts(results, annotations)
    metrics = metrics.set_index('conceptid').join(concept_counts)
    metrics.to_csv("metrics" + str(video_id) + ".csv")
    print(metrics)
    con.commit()
    con.close() 

if __name__ == '__main__':
    model_name = 'testV2' 

    s3.download_file(S3_BUCKET, S3_WEIGHTS_FOLDER + model_name + '.h5', weights_path)
    cursor.execute('''
        SELECT * FROM models
        LEFT JOIN users u ON u.id=userid
        WHERE name=%s
        ''', (model_name,))
    model = cursor.fetchone()

    video_id = 86 
    concepts = model[2]
    userid = model[4]
    model_username = model[6]

    evaluate(video_id, model_username, concepts)
