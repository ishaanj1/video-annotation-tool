import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Modal from '@material-ui/core/Modal';
import Button from '@material-ui/core/Button';
// import List from '@material-ui/core/List';
// import ListItem from '@material-ui/core/ListItem';
// import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
// import ListItemText from '@material-ui/core/ListItemText';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import geoLib from 'geolib'
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';

function getModalStyle() {
  const top = 50;
  const left = 50;

  return {
    top: `${top}%`,
    left: `${left}%`,
    transform: `translate(-${top}%, -${left}%)`,
  };
}

const styles = theme => ({
  paper: {
    position: 'absolute',
    width: theme.spacing.unit * 100,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing.unit * 4,
    outline: 'none'
  },
  root: {
    width: '100%',
    marginTop: theme.spacing.unit * 3,
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  },
});

class SimpleModal extends React.Component {
  state = {
    open: false,
    showTotal: false,
    total: null,
    anno: null,
    km: false
  };

  getTotalSpecies(data) {
    var count = 0;
    var anno = 0;
    data.forEach(element => {
      if (element.rank === 'species') {
        count++;
      }
      anno = anno + parseInt(element.count);
    });
    this.setState({ showTotal: true, total: count, anno: anno });
  }

  convertDistance = () => {
    if (this.state.km)
      this.setState({km : false});
    else
      this.setState({km : true});
  }

  setDecimal(data) {
    return parseFloat(data).toFixed(5);
  }

  render() {
    const { classes } = this.props;
    var start, end, dist, depth;

    if (this.props.gpsstart && this.props.gpsstop) {
      start = { latitude: this.props.gpsstart.x, longitude: this.props.gpsstart.y };
      end = { latitude: this.props.gpsstop.x, longitude: this.props.gpsstop.y };
      dist = geoLib.getDistance(start, end, 1, 3);
    }
    if (this.props.startdepth && this.props.enddepth) {
      depth = this.props.startdepth - this.props.enddepth;
    }

    return (
      <div>
        <Modal
          aria-labelledby="simple-modal-title"
          aria-describedby="simple-modal-description"
          open={this.props.open}
          onClose={this.props.handleClose}
        >
          <div style={getModalStyle()} className={classes.paper}>
            <Paper style={{ maxHeight: 400, overflow: 'auto' }}>
              {/* {this.props.summary &&
                <List disablePadding>
                  {this.props.summary.data.map(concept => (
                    <React.Fragment key={concept.id}>
                      <ListItem>
                        <Avatar src={`/api/conceptImages/${concept.id}`} />
                        <ListItemText inset primary={concept.name} />
                        <ListItemText primary={concept.count + ' anno'} />
                        <ListItemSecondaryAction className={classes.shiftRight}>
                          {this.setTwoNumberDecimal(concept.count / (dist * 2)) + ' cr/m^2'}
                        </ListItemSecondaryAction>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              } */}
              <Table className={classes.table}>
                <TableHead>
                  <TableRow>
                    <TableCell>Picture</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell align="right"># of Annotations</TableCell>
                    <TableCell align="right">{this.state.km ? 'Creatures per km' : 'Creatures per square meter'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {this.props.summary ? this.props.summary.data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell><Avatar src={`/api/conceptImages/${row.id}`} /></TableCell>
                      <TableCell component="th" scope="row">
                        {row.name}
                      </TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                      <TableCell align="right">{this.state.km ? this.setDecimal(row.count / (dist * 1000)) : 
                        this.setDecimal(row.count / (dist * 2))}</TableCell>
                    </TableRow>
                  )) : <TableRow key={1}><TableCell>''</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
            <div>
              {this.props.summary &&
                <Button onClick={() => this.getTotalSpecies(this.props.summary.data)} color="primary">
                  Total
                </Button>}
              {this.props.summary &&
                <Button onClick={() => this.convertDistance()} color="primary">
                  Convert
                </Button>}
              {this.state.showTotal ?
                <div>
                  <Typography variant="body2" gutterBottom>
                    {"total species: " + this.state.total}</Typography>
                  <Typography variant="body2" gutterBottom>
                    {"total annotations: " + this.state.anno}</Typography>
                  <Typography variant="body2" gutterBottom>
                    {"total density(cr/m^2): " + this.setDecimal(this.state.anno / (dist * 2))}</Typography>
                  <Typography variant="body2" gutterBottom>
                    {"total distance covered(m): " + dist}</Typography>
                  <Typography variant="body2" gutterBottom>
                    total depth covered(m): {depth < 0 ? 'descended ' + Math.abs(depth) : 'ascended ' + Math.abs(depth)}</Typography>
                </div>
                : ''}
            </div>
          </div>

        </Modal>
      </div>
    );
  }
}

SimpleModal.propTypes = {
  classes: PropTypes.object.isRequired,
};

// We need an intermediary variable for handling the recursive nesting.
const SimpleModalWrapped = withStyles(styles)(SimpleModal);

export default SimpleModalWrapped;