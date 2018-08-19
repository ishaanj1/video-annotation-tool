import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

//import Divider from '@material-ui/core/Divider';

const styles = theme => ({
  root: {
    backgroundColor: theme.palette.background.paper,

  },
  item: {
    paddingTop: 0
  }
});

class AnnotationFrame extends Component {
  constructor(props) {
    super(props);
    this.state = {
      image: null,
      isLoaded: false,
      error: null,
      width: null,
      height: null,
    };
  }

  getVideoImage = (path, secs, callback) => {
    var me = this;
    var video = document.createElement('video');
    video.setAttribute('crossOrigin', 'use-credentials');
    video.onloadedmetadata = function() {
      // this.currentTime = Math.min(Math.max(0, (secs < 0 ? this.duration : 0) + secs), this.duration);
      this.currentTime = secs;
    };
    video.onseeked = function(e) {
      var canvas = document.createElement('canvas');
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var img = new Image();
      img.setAttribute('crossOrigin', 'use-credentials');
      img.src = canvas.toDataURL();
      callback.call(me, img, this.currentTime, e);
    };
    video.onerror = function(e) {
      callback.call(me, undefined, undefined, e);
    };
    video.src = path;
  }

  componentDidMount = async () => {
    console.log(this.props.annotation)
    this.getVideoImage('https://d1yenv1ac8fa55.cloudfront.net/videos/'+this.props.annotation.filename,
     this.props.annotation.timeinvideo,
    function(img, secs, event) {
      if (event.type === 'seeked') {
        this.setState({
          isLoaded: true,
          image: img,
        })
      }
    });
  };

  render () {
    const { error, isLoaded, image } = this.state;
    const { classes } = this.props;



    if (!isLoaded) {
      return <List>Loading...</List>;
    }
    if (error)  {
      return <List>Error: {error.message}</List>;
    }
    return (
      <React.Fragment>
        <List className={classes.root}>
            <ListItem className={classes.item}>
              <img id = 'imageId' src={image.src} alt='error' />
              <div style={{
                position: 'absolute',
                //top: '0px',
                //left: '24px',
                //left: ((this.props.annotation.botleftx/1280)*1920)+30,
                top: ((this.props.annotation.toprighty/720)*1080),
                left: (((this.props.annotation.botleftx/1280)*1920)+24),
                //left: this.props.annotation.botlefty,
                // marginLeft: 0,
                height: ((this.props.annotation.botlefty-this.props.annotation.toprighty)/720)*1080,
                width: ((this.props.annotation.toprightx-this.props.annotation.botleftx)/1280)*1920,
                borderStyle: 'solid',
                borderWidth: '1px',
                borderColor: 'coral',
              }}>
              </div>
            </ListItem>
        </List>
      </React.Fragment>
    );
  }

}

AnnotationFrame.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AnnotationFrame);
