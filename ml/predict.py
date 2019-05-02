from dotenv import load_dotenv
from keras_retinanet.models import convert_model
from keras_retinanet.models import load_model
import cv2
import json
import numpy as np
import argparse
import copy
import os
import boto3
import keras
import pandas as pd
import uuid
from loading_data import queryDB


#Load environment variables
load_dotenv(dotenv_path="../.env")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET = os.getenv('AWS_S3_BUCKET_NAME')
s3 = boto3.client('s3', aws_access_key_id = AWS_ACCESS_KEY_ID, aws_secret_access_key = AWS_SECRET_ACCESS_KEY)
S3_VIDEO_FOLDER = os.getenv('AWS_S3_BUCKET_VIDEOS_FOLDER')

argparser = argparse.ArgumentParser()
argparser.add_argument(
   '-c',
   '--conf',
   default='config.json',
   help='path to configuration file')

args = argparser.parse_args()
config_path = args.conf

with open(config_path) as config_buffer:
   config = json.loads(config_buffer.read())

model_path = config['model_weights']
concepts = config['conceptids']
NUM_FRAMES = config['frames_between_predictions'] # run prediction on every NUM_FRAMES
THRESHOLDS = config['prediction_confidence_thresholds']
IOU_THRESH = config['prediction_matching_threhold']
OBJECT_CONFIDENCE_THRESH = 0.30
OBJECT_LENGTH_THRESH = 15 # frames


class Tracked_object:

   def __init__(self, detection, frame, frame_num):
      self.annotations = pd.DataFrame(columns=['x1','y1','x2','y2','label', 'confidence', 'objectid','frame_num'])
      (x1, y1, x2, y2) = detection[0]
      self.id = uuid.uuid4()
      self.x1 = x1
      self.x2 = x2
      self.y1 = y1
      self.y2 = y2
      self.box = (x1, y1, (x2-x1), (y2-y1))
      self.tracker = cv2.TrackerKCF_create()
      self.tracker.init(frame, self.box)
      label = detection[2]
      confidence = detection[1]
      self.save_annotation(frame_num,label=label, confidence=confidence)

   def save_annotation(self, frame_num, label=None, confidence=None):
      annotation = {}
      annotation['x1'] = self.x1
      annotation['y1'] = self.y1
      annotation['x2'] = self.x2
      annotation['y2'] = self.y2
      annotation['label'] = label
      annotation['confidence'] = confidence
      annotation['objectid'] = self.id
      annotation['frame_num'] = frame_num
      self.annotations = self.annotations.append(annotation, ignore_index=True)

   def reinit(self, detection, frame, frame_num):
      (x1, y1, x2, y2) = detection[0]
      self.x1 = x1
      self.x2 = x2
      self.y1 = y1
      self.y2 = y2
      self.box = (x1, y1, (x2-x1), (y2-y1))
      self.tracker = cv2.TrackerKCF_create()
      self.tracker.init(frame, self.box) 
      label = detection[2]
      confidence = detection[1]
      self.annotations = self.annotations[:-1]
      self.save_annotation(frame_num, label=label, confidence=confidence)

   def update(self, frame, frame_num):
      success, box = self.tracker.update(frame)
      if success:
         (x1, y1, w, h) = [int(v) for v in box]
         self.x1 = x1
         self.x2 = x1 + w
         self.y1 = y1
         self.y2 = y1 + h 
         self.box = (x1, y1, w, h)
         self.save_annotation(frame_num)
      return success

def main(videoid):
   userid = 29
   video_name = queryDB("select * from videos where id = " + str(videoid)).iloc[0].filename
   print("Loading Video")
   frames, fps = get_video_frames(video_name)
   original_frames = copy.deepcopy(frames)
   print("Initializing Model")
   model = init_model()
   print("Predicting")
   results, frames = predict_frames(frames, fps, model)

   # results.frame_num = results.frame_num+ 160 * 30
   save_video(frames)

   results = conf_limit_objects(results, OBJECT_CONFIDENCE_THRESH)
   results = propagate_conceptids(results)
   results = length_limit_objects(results, OBJECT_LENGTH_THRESH)

   # filter results down to middles
   middles = the_middler(results)
   middles.apply(lambda x: handle_annotation(x, original_frames, videoid. videoheight, videowidth, userid))
   return results

def the_middler(results)
  middle_frames = []

  for obj in [df for _, df in results.groupby('objectid')]:
      middle_frame = int(obj.frame_num.median())
      frame = obj[obj.frame_num == middle_frame]
      
      if frame.shape == (0, 10):
          continue
      middle_frames.append(frame.values.tolist()[0])
      
  middle_frames = pd.DataFrame(middle_frames)
  middle_frames.columns = results.columns
  return middle_frames

def handle_annotation(x, frames, videoid. videoheight, videowidth, userid):
  frame = x.frame_num
  frame_w_box = get_boxed_image(x.x1, x.x2, x.y1, x.y2, copy.deepcopy(frame))
  upload_annotation(frame, frame_w_box, x.x1, x.x2, x.y1, x.y2, x.frame_num, x.conceptid, videoid, videoheight, videowidth, userid)


def get_boxed_image(x1, x2, y1, y2, frame):
  cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
  return frame

#Uploads images and puts annotation in database
def upload_annotation(frame, frame_w_box, x1, x2, y1, y2, frame_num, conceptid, videoid, videowidth, videoheight, userid):
  con = psycopg2.connect(database = DB_NAME,
                      user = DB_USER,
                      password = DB_PASSWORD,
                      host = DB_HOST,
                      port = "5432")
  cursor = con.cursor()
  
  no_box = str(annotation.videoid) + "_" + str(timeinvideo) + "_ai.png"
  box = str(annotation.id) + "_" + str(timeinvideo) + "_box_ai.png"
  temp_file = str(uuid.uuid4()) + ".png"
  cv2.imwrite(temp_file, frame)
  s3.upload_file(temp_file, S3_BUCKET, S3_ANNOTATION_FOLDER + no_box, ExtraArgs={'ContentType':'image/png'}) 
  os.system('rm '+ temp_file)
  
  cv2.imwrite(temp_file, frame_w_box)
  s3.upload_file(temp_file, S3_BUCKET, S3_ANNOTATION_FOLDER + box,  ExtraArgs={'ContentType':'image/png'})
  os.system('rm '+ temp_file)
  
  tieminvideo = frame_num / FPS
  
  cursor.execute(
    """
   INSERT INTO annotations (
   framenum, videoid, userid, conceptid, timeinvideo, x1, y1, x2, y2, 
   videowidth, videoheight, dateannotated, image, imagewithbox) 
   VALUES (%d, %d, %d, %d, %f, %f, %f, %f, %f, %d, %d, %s, %s, %s, %s, %s, %d)
    """,
     (
   frame_num, videoid, userid,conceptid, timeinvideo, x1, y1, 
   x2, y2, video_width, video_height, datetime.datetime.now().date(), no_box, box
     )
  )
  con.commit()
  con.close()



def get_video_frames(video_name):
   frames = []
   # grab video stream
   url = s3.generate_presigned_url('get_object',
            Params = {'Bucket': S3_BUCKET,
                      'Key': S3_VIDEO_FOLDER + video_name},
                       ExpiresIn = 100)
   vid = cv2.VideoCapture(url)
   fps = vid.get(cv2.CAP_PROP_FPS)

   while not vid.isOpened():
      continue
   print("Successfully opened video.")
   # put frames into frame list
   check = True

   while True:
   # vid.set(0, 160000)
   # for i in range(0, 900): 
      check, frame = vid.read()
      if not check:
         break
      frame = cv2.resize(frame,(640,480))
      frames.append(frame)
   vid.release()
   return frames,fps

def init_model():
   model = load_model(model_path, backbone_name='resnet50')
   model = convert_model(model)
   return model

def predict_frames(video_frames, fps, model):
   currently_tracked_objects = []
   annotations = []
   for i, frame in enumerate(video_frames):
      frame_num = i
      # update tracking for currently tracked objects
      for obj in currently_tracked_objects:
         success = obj.update(frame, frame_num)
         if not success:
            annotations.append(obj.annotations)
            currently_tracked_objects.remove(obj)
            #Should really check if there is a matching prediction if the tracking fails
      # for every NUM_FRAMES, get new predections, check if any detections match a currently tracked object
      if i % NUM_FRAMES == 0:
          detections = get_predictions(frame, model)
          for detection in detections:
             match, matched_object = does_match_existing_tracked_object(detection, currently_tracked_objects)
             if not match:
                currently_tracked_objects.append(Tracked_object(detection, frame, frame_num))
             else:
                 matched_object.reinit(detection, frame, frame_num)
      # draw boxes 
      for obj in currently_tracked_objects:
         (x, y, w, h) = obj.box
         cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
   results = pd.concat(annotations)
   results.to_csv('results.csv')
   return results, video_frames

# Limit Results based on object max frame confidence
def conf_limit_objects(pred, conf_thresh):
    max_conf = pd.DataFrame(pred.groupby('objectid').confidence.max())
    above_thresh = max_conf[max_conf.confidence > conf_thresh].index
    return pred[[(obj in above_thresh) for obj in pred.objectid]]
   
# Limit results based on tracked object length (ex. > 30 frames)
def length_limit_objects(pred, frame_thresh):
    obj_len = pred.groupby('objectid').conceptid.value_counts()
    len_thresh = obj_len[obj_len > frame_thresh]
    return pred[[(obj in len_thresh) for obj in pred.objectid]] 

# Given a list of annotations(some with or without labels/confidence scores) for multiple objects choose a label for each object
def propagate_conceptids(annotations):
    label = None
    objects = annotations.groupby(['objectid'])
    for oid, group in objects:
        scores = {}
        for k , label in group.groupby(['label']):
            scores[k] = label.confidence.mean() # Maybe the sum?
        idmax = max(scores.keys(), key=(lambda k: scores[k]))
        annotations.loc[annotations.objectid == oid,'label'] = idmax
    annotations['label'] = annotations['label'].apply(lambda x: concepts[int(x)])
    annotations['conceptid'] = annotations['label']
    return annotations
   
def get_predictions(frame, model):
   frame = np.expand_dims(frame, axis=0)
   boxes, scores, labels = model.predict_on_batch(frame)

   predictions = zip (boxes[0],scores[0],labels[0])
   filtered_predictions = []
   for box, score,label in predictions:
      if THRESHOLDS[label] > score:
         continue
      filtered_predictions.append((box,score,label))
   return filtered_predictions

def save_video(frames):
   fourcc = cv2.VideoWriter_fourcc(*'mp4v')
   out = cv2.VideoWriter('output.mp4',fourcc, 30.0, frames[0].shape[::-1][1:3])
   for frame in frames:
      out.write(frame)
   out.release()
   cv2.destroyAllWindows()

def does_match_existing_tracked_object(detection, currently_tracked_objects):
    # calculate IOU for each
   max_iou = 0 
   match = None
   for obj in currently_tracked_objects:
       (x1, y1, x2, y2) = detection[0]
       # determine the (x, y)-coordinates of the intersection rectangle
       xA = max(x1, obj.x1)
       yA = max(y1, obj.y1)
       xB = min(x2, obj.x2)
       yB = min(y2, obj.y2)
       # compute the area of intersection rectangle
       interArea = max(0, xB - xA + 1) * max(0, yB - yA + 1)
       # compute the area of both the prediction and ground-truth
       # rectangles
       boxAArea = (x2 - x1 + 1) * (y2 - y1 + 1)
       boxBArea = (obj.x2 - obj.x1 + 1) * (obj.y2 - obj.y1 + 1)
       # compute the intersection over union by taking the intersection
       # area and dividing it by the sum of prediction + ground-truth
       # areas - the interesection area
       iou = interArea / float(boxAArea + boxBArea - interArea)
       if (iou > max_iou):
          max_iou = iou
          match = obj
   if max_iou >= IOU_THRESH:               
      return True, match
   return False, None

if __name__ == '__main__':
  main()
