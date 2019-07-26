import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepContent from '@material-ui/core/StepContent';
import Button from '@material-ui/core/Button';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import FormControl from '@material-ui/core/FormControl';
import Typography from '@material-ui/core/Typography';

import SelectUser from '../Utilities/SelectUser.jsx';
import SelectVideo from '../Utilities/SelectVideo.jsx';
import SelectConcept from '../Utilities/SelectConcept.jsx';
import SelectUnsure from '../Utilities/SelectUnsure';
import VerifyAnnotationCollection from '../Utilities/SelectAnnotationCollection.jsx';

const styles = theme => ({
  button: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing()
  },
  actionsContainer: {
    marginBottom: theme.spacing(2)
  },
  resetContainer: {
    padding: theme.spacing(3)
  },
  formControl: {
    marginTop: theme.spacing(2),
    maxHeight: '400px',
    overflow: 'auto'
  },
  switch: {
    marginLeft: theme.spacing(2)
  }
});

function getSteps() {
  return ['Annotation Collections', 'Users', 'Videos', 'Concepts', 'Unsure'];
}

class VerifySelection extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeStep: 0
    };
  }

  getStepForm = step => {
    const { classes } = this.props;
    switch (step) {
      case 0:
        return (
          <VerifyAnnotationCollection
            value={this.props.selectedAnnotationCollections}
            getAnnotationCollections={this.props.getAnnotationCollections}
            selectedAnnotationCollections={
              this.props.selectedAnnotationCollections
            }
            handleChangeList={this.props.handleChangeList(
              this.props.selectedAnnotationCollections,
              'selectedAnnotationCollections'
            )}
          />
        );
      case 1:
        return (
          <SelectUser
            value={this.props.selectedUsers}
            getUsers={this.props.getUsers}
            selectUser={this.props.selectUser}
            handleChangeList={this.props.handleChangeList(
              this.props.selectedUsers,
              'selectedUsers'
            )}
            handleSelectAll={this.props.handleSelectAll}
            handleUnselectAll={this.props.handleUnselectAll}
          />
        );
      case 2:
        return (
          <SelectVideo
            value={this.props.selectedVideos}
            getVideos={this.props.getVideos}
            getVideoCollections={this.props.getVideoCollections}
            handleChange={this.props.handleChange('selectedVideos')}
            handleChangeList={this.props.handleChangeList(
              this.props.selectedVideos,
              'selectedVideos'
            )}
            handleSelectAll={this.props.handleSelectAll}
            handleUnselectAll={this.props.handleUnselectAll}
          />
        );
      case 3:
        return (
          <SelectConcept
            value={this.props.selectedConcepts}
            getConcepts={this.props.getConcepts}
            getConceptCollections={this.props.getConceptCollections}
            handleChange={this.props.handleChange('selectedConcepts')}
            handleChangeList={this.props.handleChangeList(
              this.props.selectedConcepts,
              'selectedConcepts'
            )}
            handleSelectAll={this.props.handleSelectAll}
            handleUnselectAll={this.props.handleUnselectAll}
          />
        );
      case 4:
        return (
          <div>
            <SelectUnsure
              value={this.props.selectedUnsure}
              getUnsure={this.props.getUnsure}
              handleChangeSwitch={this.props.handleChangeSwitch(
                'selectedUnsure'
              )}
            />
            <div>
              <Typography>Select Video First</Typography>
              <FormControl component="fieldset" className={classes.formControl}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        className={classes.switch}
                        checked={this.props.selectedTrackingFirst}
                        onChange={this.props.handleChangeSwitch(
                          'selectedTrackingFirst'
                        )}
                        value="selectedTrackingFirst"
                        color="primary"
                      />
                    }
                    label="Tracking Video Verification"
                  />
                </FormGroup>
              </FormControl>
            </div>
          </div>
        );
      default:
        return 'Unknown step';
    }
  };

  didNotSelect = step => {
    switch (step) {
      case 0:
        return false;
      case 1:
        return this.props.selectedUsers.length === 0;
      case 2:
        return this.props.selectedVideos.length === 0;
      case 3:
        return this.props.selectedConcepts.length === 0;
      default:
        return false;
    }
  };

  handleNext = () => {
    this.setState(state => ({
      activeStep: state.activeStep + 1
    }));
  };

  handleBack = step => {
    this.props.resetStep(step);
    this.setState({
      activeStep: this.state.activeStep - 1
    });
  };

  resetState = () => {
    this.props.resetState();
    this.setState({
      activeStep: 0
    });
  };

  render() {
    const { activeStep } = this.state;
    const { classes } = this.props;
    const steps = getSteps();

    return (
      <div className={classes.root}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {this.getStepForm(index)}
                <div className={classes.actionsContainer}>
                  <div>
                    <Button
                      variant="contained"
                      onClick={this.resetState}
                      className={classes.button}
                    >
                      Reset All
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        this.handleBack(activeStep);
                      }}
                      className={classes.button}
                      disabled={this.state.activeStep === 0}
                    >
                      Back
                    </Button>
                    {activeStep === 0 &&
                    this.props.selectedAnnotationCollections.length !== 0 ? (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={this.props.toggleSelection}
                        className={classes.button}
                      >
                        Skip To Annotations Verify
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={this.didNotSelect(index)}
                        onClick={
                          activeStep === steps.length - 1
                            ? this.props.toggleSelection
                            : this.handleNext
                        }
                        className={classes.button}
                      >
                        {activeStep === steps.length - 1
                          ? 'Finish'
                          : activeStep === 0 &&
                            this.props.selectedAnnotationCollections.length ===
                              0
                          ? 'Skip this step'
                          : 'Next'}
                      </Button>
                    )}
                  </div>
                </div>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </div>
    );
  }
}

VerifySelection.propTypes = {
  classes: PropTypes.object
};

export default withStyles(styles)(VerifySelection);
