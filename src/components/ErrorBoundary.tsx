import {Component,type ReactNode} from 'react';
import {reportError} from '../lib/diagnostics';
export class ErrorBoundary extends Component<{children:ReactNode;feature:string;locale:string},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){reportError(this.props.feature,'render',{code:'render_failed'});}
 render(){return this.state.failed?<section className="empty-view" role="alert"><h2>{this.props.locale==='ru'?'Этот экран временно недоступен':'This screen is temporarily unavailable'}</h2><button className="button secondary" onClick={()=>this.setState({failed:false})}>{this.props.locale==='ru'?'Повторить':'Retry'}</button></section>:this.props.children;}
}
