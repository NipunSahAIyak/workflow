import React from 'react'
import App from './page'
import { Provider } from 'react-redux'; 
import { store } from './redux/store';
describe('<App />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(
      <Provider store={store}>
        <App />
      </Provider>
    )
  })
})