import ReactDOM from 'react-dom';

function App() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h2>
        🚀 App is succesfully installed! Please go to{' '}
        <a href="https://dashboard.heroku.com/apps/gymbrosproject/settings">
          heroku settings
        </a>{' '}
        to update the configuration.
        <br />
        Buttons can be styled in theme code editor
        "sections/wallet-button.liquid" if needed
      </h2>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('app'));
