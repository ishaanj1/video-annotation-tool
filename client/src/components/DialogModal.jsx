import React, { Component } from 'react';
import Input from '@material-ui/core/Input';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import { withStyles } from '@material-ui/core/styles';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

const styles = theme => ({
  paper: {
    width: theme.spacing.unit * 50,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing.unit * 4,
    display: 'block',
    margin: 'auto',
    overflow: 'auto',
  },
});

class DialogModal extends Component {

  constructor(props) {
    super(props);
    this.state = {
      unsure: false,
      submit_enabled: true
    };
  }

  handleClose = () => {
    this.setState({unsure: false});
    this.props.handleClose();
  };

  handleKeyPress = (e) => {
    if (e.key === 'Enter' && this.state.submit_enabled) {
      this.props.inputHandler(e.target.value, this.state.unsure);
      this.setState({submit_enabled: false});
      this.props.handleClose();
    }
    else {
      this.comment = e.target.value + e.key // saves the comment
    }
  };

  handleSubmit = () => {
    this.props.inputHandler(this.comment, this.state.unsure)
    this.setState({unsure : false});
  };

  handleChange = () => event => {
    this.setState({ unsure: event.target.checked });
  };

  render() {
    return (
      <React.Fragment>
        <Dialog
          open={this.props.open}
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">{this.props.title}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {this.props.message}
            </DialogContentText>
            <br/>
            <Input
              onKeyPress={this.handleKeyPress}
              autoFocus
              margin="dense"
              id="concept"
              type="text"
              placeholder={this.props.placeholder}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <FormControlLabel
            control={
              <Checkbox
                checked={this.state.unsure}
                onChange={this.handleChange()}
                value="unsure"
                color="primary"
              />
            }
            label="Unsure"
            />
            <Button onClick={this.handleClose} color="primary">
              Cancel
            </Button>
            <Button onClick={this.handleSubmit} color="primary">
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}

export default withStyles(styles)(DialogModal);
