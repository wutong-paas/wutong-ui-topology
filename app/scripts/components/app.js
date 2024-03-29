import debug from 'debug';
import { debounce } from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import {
  focusSearch,
  hitBackspace,
  hitEsc,
  pinNextMetric,
  pinPreviousMetric,
  setGraphView,
  setResourceView,
  setTableView,
  setViewportDimensions,
  shutdown,
  toggleHelp,
  unpinMetric
} from '../actions/app-actions';
import { BACKSPACE_KEY_CODE, ESC_KEY_CODE } from '../constants/key-codes';
import { VIEWPORT_RESIZE_DEBOUNCE_INTERVAL } from '../constants/timer';
import { availableNetworksSelector } from '../selectors/node-networks';
import {
  activeTopologyOptionsSelector,
  isGraphViewModeSelector,
  isResourceViewModeSelector,
  isTableViewModeSelector
} from '../selectors/topology';
import { getRouter, getUrlState } from '../utils/router-utils';
import { trackMixpanelEvent } from '../utils/tracking-utils';
import { getTopologies } from '../utils/web-api-utils';
import { toggleDebugToolbar } from './debug-toolbar';
import Details from './details';
import Nodes from './nodes';

const keyPressLog = debug('scope:app-key-press');
require('../../styles/font-awesome.min.css');


class App extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.setViewportDimensions = this.setViewportDimensions.bind(this);
    this.handleResize = debounce(
      this.setViewportDimensions,
      VIEWPORT_RESIZE_DEBOUNCE_INTERVAL
    );

    this.saveAppRef = this.saveAppRef.bind(this);
    this.onKeyPress = this.onKeyPress.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }
  componentWillMount() {
    const hash = window.location.hash;
    if (hash) {
      window.location.hash = '';
    }
  }
  componentDidMount() {
    this.setViewportDimensions();
    // window.addEventListener('resize', this.handleResize);
    // window.addEventListener('keypress', this.onKeyPress);
    window.addEventListener('keyup', this.onKeyUp);
    getRouter(this.props.dispatch, this.props.urlState).start({
      hashbang: true,
    });

    if (!this.props.routeSet || process.env.WEAVE_CLOUD) {
      // dont request topologies when already done via router.
      // If running as a component, always request topologies when the app mounts.
      getTopologies(
        this.props.activeTopologyOptions,
        this.props.dispatch,
        true
      );
    }
    // getApiDetails(this.props.dispatch);
  }
  componentWillUnmount() {
    window.addEventListener('resize', this.handleResize);
    window.removeEventListener('keypress', this.onKeyPress);
    window.removeEventListener('keyup', this.onKeyUp);
    this.props.dispatch(shutdown());
  }
  onKeyUp(ev) {
    const { showingTerminal } = this.props;
    keyPressLog('onKeyUp', 'keyCode', ev.keyCode, ev);

    // don't get esc in onKeyPress
    if (ev.keyCode === ESC_KEY_CODE) {
      this.props.dispatch(hitEsc());
    } else if (ev.keyCode === BACKSPACE_KEY_CODE) {
      this.props.dispatch(hitBackspace());
    } else if (ev.code === 'KeyD' && ev.ctrlKey && !showingTerminal) {
      toggleDebugToolbar();
      this.forceUpdate();
    }
  }
  onKeyPress(ev) {
    const { dispatch, searchFocused, showingTerminal } = this.props;
    //
    // keyup gives 'key'
    // keypress gives 'char'
    // Distinction is important for international keyboard layouts where there
    // is often a different {key: char} mapping.
    if (!searchFocused && !showingTerminal) {
      keyPressLog('onKeyPress', 'keyCode', ev.keyCode, ev);
      const char = String.fromCharCode(ev.charCode);
      if (char === '<') {
        dispatch(pinPreviousMetric());
        this.trackEvent('scope.metric.selector.pin.previous.keypress', {
          metricType: this.props.pinnedMetricType,
        });
      } else if (char === '>') {
        dispatch(pinNextMetric());
        this.trackEvent('scope.metric.selector.pin.next.keypress', {
          metricType: this.props.pinnedMetricType,
        });
      } else if (char === 'g') {
        dispatch(setGraphView());
        this.trackEvent('scope.layout.selector.keypress');
      } else if (char === 't') {
        dispatch(setTableView());
        this.trackEvent('scope.layout.selector.keypress');
      } else if (char === 'r') {
        dispatch(setResourceView());
        this.trackEvent('scope.layout.selector.keypress');
      } else if (char === 'q') {
        this.trackEvent('scope.metric.selector.unpin.keypress', {
          metricType: this.props.pinnedMetricType,
        });
        dispatch(unpinMetric());
      } else if (char === '/') {
        ev.preventDefault();
        dispatch(focusSearch());
      } else if (char === '?') {
        dispatch(toggleHelp());
      }
    }
  }
  trackEvent(eventName, additionalProps = {}) {
    trackMixpanelEvent(eventName, {
      layout: this.props.topologyViewMode,
      topologyId: this.props.currentTopology.get('id'),
      parentTopologyId: this.props.currentTopology.get('parentId'),
      ...additionalProps,
    });
  }
  // 设置视图 的高
  setViewportDimensions() {
    if (this.appRef) {
      const { width, height } = this.appRef.getBoundingClientRect();
      this.props.dispatch(setViewportDimensions(width, height));
      setTimeout(() => {
        this.forceUpdate();
      });
    }
  }

  saveAppRef(ref) {
    this.appRef = ref;
  }

  render() {
    const { showingDetails, monitorData } = this.props;
    const mData = monitorData ? monitorData.data || {} : {};
    return (
      <div className="scope-app" ref={this.saveAppRef}>
        {showingDetails && <Details />}
        <Nodes />
        {monitorData && (
          <span
            style={{
              borderRadius: '6px',
              border: '1px solid #dedece',
              padding: '10px 20px',
              position: 'fixed',
              left: monitorData.left,
              top: monitorData.top - 60,
              zIndex: 9999,
              background: 'black',
            }}
          >
            吞吐率 - 点密度表示: {mData.throughput_rate || '-'} dps <br />{' '}
            响应时间 - 点速度表示: {mData.response_time || '-'} ms
          </span>
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    activeTopologyOptions: activeTopologyOptionsSelector(state),
    currentTopology: state.get('currentTopology'),
    isResourceViewMode: isResourceViewModeSelector(state),
    isTableViewMode: isTableViewModeSelector(state),
    isGraphViewMode: isGraphViewModeSelector(state),
    pinnedMetricType: state.get('pinnedMetricType'),
    routeSet: state.get('routeSet'),
    searchFocused: state.get('searchFocused'),
    searchQuery: state.get('searchQuery'),
    showingDetails: state.get('nodeDetails').size > 0,
    showingHelp: state.get('showingHelp'),
    showingTroubleshootingMenu: state.get('showingTroubleshootingMenu'),
    showingNetworkSelector: availableNetworksSelector(state).count() > 0,
    showingTerminal: state.get('controlPipes').size > 0,
    topologyViewMode: state.get('topologyViewMode'),
    urlState: getUrlState(state),
    monitorData: state.get('monitorData'),
  };
}

export default connect(mapStateToProps)(App);
