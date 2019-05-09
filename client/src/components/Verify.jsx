import React, { Component } from "react";
import axios from "axios";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

import VerifySelection from "./VerifySelection.jsx";

const styles = theme => ({
  root: {
    width: "90%"
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit
  },
  actionsContainer: {
    marginBottom: theme.spacing.unit * 2
  },
  resetContainer: {
    padding: theme.spacing.unit * 3
  },
  list: {
    width: '100%',
    backgroundColor: theme.palette.background.paper,
  },  
  item: {
    display: 'inline',
    paddingTop: 0,
    width: '1300px',
    height: '730px',
    paddingLeft: 0
  },
  img: {
    width: '1280px',
    height: '720px',
  }
});

class Verify extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectionMounted: true,
      selectedUser: "0",
      selectedVideos: [],
      selectedConcepts: [],
      annotations: [],
      error: null,
      isLoaded: false
    };
  }

  unmountSelection = () => {
    if (!this.state.selectionMounted) {
      this.handleReset();
    }
    this.setState({
      selectionMounted: !this.state.selectionMounted
    });
  };

  getUsers = async () => {
    return axios
      .get(`/api/users`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getVideos = async () => {
    return axios
      .get(`/api/unverifiedVideosByUser/` + this.state.selectedUser, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getConcepts = async () => {
    return axios
      .get("/api/unverifiedConceptsByUserVideo/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        params: {
          selectedUser: this.state.selectedUser,
          selectedVideos: this.state.selectedVideos
        }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getAnnotations = async () => {
    return axios
      .get(`/api/unverifiedAnnotationsByUserVideoConcept/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        params: {
          selectedUser: this.state.selectedUser,
          selectedVideos: this.state.selectedVideos,
          selectedConcepts: this.state.selectedConcepts
        }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };


  encode = (data) => {
    var str = data.reduce(function(a,b) { return a+String.fromCharCode(b) },'');
    console.log(btoa(str).replace(/.{76}(?=.)/g,'$&\n'));
    return btoa(str).replace(/.{76}(?=.)/g,'$&\n');
  }

  getImage = (id) => {
    const config = {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    };
    var name;
    console.log(this.state.annotations[id]);
    if (this.state.annotations[id].imagewithbox) {
      name = this.state.annotations[id].imagewithbox;
    }
    else {
      return "no Img"
    }
    console.log(name);
    axios.get(`/api/annotationImages/${name}`, config).then(res => {
      console.log(res);
      // this.setState({
      return ('data:image/png;base64, ' + this.encode(res.data.image.data));
        // isLoaded: true
      // });
    }).catch(error => {
      console.log(error);
      console.log(JSON.parse(JSON.stringify(error)));
      if (!error.response) {
        return;
      }
      let errMsg = error.response.data.detail ||
        error.response.data.message || 'Error';
      console.log(errMsg);
      return errMsg;
    });
  };


  handleGetAnnotations = async () => {
    let annotations = await this.getAnnotations();

    if (!annotations) {
      return;
    }

    this.setState({
      annotations: annotations
    });
  };

  handleChangeUser = event => {
    this.setState({ selectedUser: event.target.value });
  };

  handleChangeVideo = event => {
    if (!this.state.selectedVideos.includes(event.target.value)) {
      this.setState({
        selectedVideos: this.state.selectedVideos.concat(event.target.value)
      });
    } else {
      this.setState({
        selectedVideos: this.state.selectedVideos.filter(
          videoid => videoid !== event.target.value
        )
      });
    }
  };

  handleChangeConcept = event => {
    if (!this.state.selectedConcepts.includes(event.target.value)) {
      this.setState({
        selectedConcepts: this.state.selectedConcepts.concat(event.target.value)
      });
    } else {
      this.setState({
        selectedConcepts: this.state.selectedConcepts.filter(
          conceptid => conceptid !== event.target.value
        )
      });
    }
  };

  handleReset = () => {
    this.setState({
      selectedUser: "0",
      selectedVideos: [],
      selectedConcepts: []
    });
  };

  handleListClick = async (name, id) => {
    let selected = this.state.annotations[id];
    if (!selected.expanded === undefined) {
      selected.expanded = true;
    }
    else {
      selected.expanded = !selected.expanded;
    }
    this.setState({
      isLoaded: true
    });
  }

  render() {
    console.log(this.state);
    const { classes } = this.props;
    let selection = "";
    if (this.state.selectionMounted) {
      selection = (
        <VerifySelection
          selectedUser={this.state.selectedUser}
          selectedVideos={this.state.selectedVideos}
          selectedConcepts={this.state.selectedConcepts}
          getUsers={this.getUsers}
          getVideos={this.getVideos}
          getConcepts={this.getConcepts}
          handleChangeUser={this.handleChangeUser}
          handleChangeVideo={this.handleChangeVideo}
          handleChangeConcept={this.handleChangeConcept}
          handleReset={this.handleReset}
          handleGetAnnotations={this.handleGetAnnotations}
          unmountSelection={this.unmountSelection}
        />
      );
    } else {
      selection = (
        <Paper
          square
          elevation={0}
          className={this.props.classes.resetContainer}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={this.unmountSelection}
          >
            Filter Annotations
          </Button>
          <Typography>Selected User: {this.state.selectedUser}</Typography>
          <Typography>Selected Videos: {this.state.selectedVideos}</Typography>
          <Typography>
            Selected Concepts: {this.state.selectedConcepts}
          </Typography>
          <List disablePadding className={classes.root}>
            {this.state.annotations.map((data, index) => (
              <React.Fragment key={data.id}>
                <ListItem button onClick={() => this.handleListClick(data.name, index)}>
                  <ListItemText
                    primary={data.name + ' date:' + data.dateannotated}
                  />
                  {data.expanded ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={data.expanded} timeout='auto' unmountOnExit>
                  <ListItem className={classes.item}>
                    {this.state.isLoaded ?
                      <img className={classes.img} src={`/api/annoImg/${data.id}`} alt='error' /> 
                      : "...Loading"}
                  </ListItem>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </Paper>

      );
    }

    return (<React.Fragment>{selection}
      </React.Fragment>
      );
  }
}

Verify.propTypes = {
  classes: PropTypes.object
};

export default withStyles(styles)(Verify);