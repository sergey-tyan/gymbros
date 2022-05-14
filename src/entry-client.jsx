import ReactDOM from 'react-dom';

function App() {
  return (
    <div>
      <h1>Please configure the app in heroku settings</h1>
      <p>
        Buttons can be styled in theme code editor
        "sections/wallet-button.liquid"
      </p>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('app'));
