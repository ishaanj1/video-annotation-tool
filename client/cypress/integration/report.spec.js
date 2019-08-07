beforeEach(() => {
  cy.login();
});

describe('Report', () => {
  it('Go to report', () => {
    expect(localStorage.getItem('username')).to.eq('test123');
    cy.visit('/');
    cy.get('#navbar-report').click();
    cy.get('button')
      .contains('Open Report Selector')
      .should('be.visible');
    cy.get('#selector-button').click();
  });

  it('Configure selector', () => {
    cy.get('#Level-1').select('Video');
    cy.get('#Level-2').select('Concept');
    cy.get('#ok-button').click();
  });

  it('Check my one annotation', () => {
    cy.contains('count:1')
      .should('be.visible')
      .click();
    cy.contains('longnose snailfish count:1')
      .should('be.visible')
      .click();
    cy.contains('Annotated: longnose snailfish').click();
  });

  it('test with admin', () => {
    cy.visit('/');
    cy.contains('Logout').click();
    cy.login(Cypress.env('username'), Cypress.env('password')).then(() =>
      expect(localStorage.getItem('username')).to.eq('admin')
    );
    cy.visit('/');
    cy.get('#navbar-report').click();
    cy.get('button')
      .contains('Open Report Selector')
      .should('be.visible');
    cy.get('#selector-button').click();
    cy.get('#Level-1').select('User');
    cy.get('#Level-2').select('Video');
    cy.get('#Level-3').select('Concept');
    cy.get('#ok-button').click();
    cy.contains('test123 count:1')
      .should('be.visible')
      .click();
    cy.contains('.mp4 count:1')
      .should('be.visible')
      .click();
    cy.contains('longnose snailfish count:1')
      .should('be.visible')
      .click();
    cy.contains('Annotated: longnose snailfish').click();
  });
});
