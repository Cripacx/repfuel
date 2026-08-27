import type { MessageTree, Widen } from './message-tree.js';

/**
 * Deutsche Referenz-Übersetzung. Struktur und Keys dieses Objekts definieren den
 * Typ `Messages` (siehe unten) — jede weitere Sprache (z. B. `en.ts`) muss exakt
 * dieselben Keys mit String-Werten liefern, sonst schlägt der Typcheck fehl.
 */
const de = {
  common: {
    appName: 'repfuel',
    loading: 'Lädt…',
    cancel: 'Abbrechen',
    save: 'Speichern',
    close: 'Schließen',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    yes: 'Ja',
    no: 'Nein',
    actions: 'Aktionen',
    back: 'Zurück',
  },
  language: {
    label: 'Sprache',
    de: 'Deutsch',
    en: 'Englisch',
  },
  nav: {
    home: 'Start',
    admin: 'Admin',
    logout: 'Abmelden',
    loggingOut: 'Wird abgemeldet…',
  },
  roles: {
    admin: 'Administrator',
    user: 'Nutzer',
  },
  auth: {
    loginTitle: 'Anmelden',
    registerTitle: 'Registrieren',
    usernameLabel: 'Benutzername',
    usernamePlaceholder: 'z. B. max.mustermann',
    usernameOptionalHint: 'Leer lassen für eine passwortlose Anmeldung über Passkey.',
    usernameRequiredForRegister: 'Bitte gib einen Benutzernamen ein.',
    loginWithPasskeyButton: 'Mit Passkey anmelden',
    registerWithPasskeyButton: 'Passkey registrieren',
    submitting: 'Bitte warten…',
    noAccountYet: 'Noch kein Konto?',
    registerLink: 'Jetzt registrieren',
    haveAccountAlready: 'Bereits registriert?',
    loginLink: 'Zum Login',
    bootstrapNotice:
      'Es existiert noch kein Nutzer auf dieser Instanz. Der erste registrierte Nutzer wird automatisch Administrator.',
    inviteRequiredNotice:
      'Die Registrierung ist derzeit nur mit einem gültigen Einladungslink möglich.',
    inviteTokenLabel: 'Einladungs-Token',
    inviteTokenPlaceholder: 'Token aus dem Einladungslink',
  },
  errors: {
    generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    network: 'Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung.',
    unauthorized: 'Bitte melde dich an.',
    forbidden: 'Dafür fehlt dir die Berechtigung.',
    invalidCredentials: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    usernameTaken: 'Dieser Benutzername ist bereits vergeben.',
    invalidInviteToken: 'Der Einladungslink ist ungültig oder abgelaufen.',
    webauthnCancelled: 'Die Passkey-Anmeldung wurde abgebrochen.',
    webauthnNotAllowed:
      'Der Browser hat die Passkey-Anfrage abgelehnt oder es wurde kein Passkey gefunden.',
    webauthnUnsupported: 'Dieser Browser unterstützt keine Passkeys.',
  },
  home: {
    greeting: 'Angemeldet als',
    placeholderNotice: 'Weitere Funktionen folgen in den nächsten Meilensteinen.',
    adminLinkHint: 'Du hast Administratorrechte.',
    goToAdmin: 'Zum Admin-Bereich',
  },
  admin: {
    title: 'Administration',
    loadError: 'Die Admin-Daten konnten nicht geladen werden.',
    tabs: {
      users: 'Nutzer',
      invites: 'Einladungen',
      settings: 'Einstellungen',
      status: 'Status',
    },
    users: {
      columnUsername: 'Benutzername',
      columnRole: 'Rolle',
      columnCreatedAt: 'Erstellt am',
      columnStatus: 'Status',
      statusActive: 'Aktiv',
      statusDisabled: 'Deaktiviert',
      disable: 'Deaktivieren',
      enable: 'Aktivieren',
      delete: 'Löschen',
      confirmDelete: 'Diesen Nutzer wirklich löschen? Dies kann nicht rückgängig gemacht werden.',
      empty: 'Keine Nutzer vorhanden.',
    },
    invites: {
      createTitle: 'Neue Einladung erstellen',
      usernameLabel: 'Benutzername (optional)',
      expiresLabel: 'Gültig für (Stunden)',
      createButton: 'Einladung erstellen',
      columnLink: 'Link',
      columnUsername: 'Benutzername',
      columnExpiresAt: 'Läuft ab',
      columnUsed: 'Verwendet',
      notUsed: 'Nein',
      revoke: 'Widerrufen',
      confirmRevoke: 'Diese Einladung wirklich widerrufen?',
      empty: 'Keine Einladungen vorhanden.',
      copyLink: 'Link kopieren',
    },
    settings: {
      registrationModeLabel: 'Registrierungsmodus',
      modeOpen: 'Offen (jeder kann sich registrieren)',
      modeInvite: 'Nur mit Einladung',
      configuredHint: 'Konfiguriert über Umgebungsvariable:',
      saved: 'Gespeichert.',
    },
    status: {
      versionLabel: 'Version',
      modeLabel: 'Registrierungsmodus',
      userCountLabel: 'Anzahl Nutzer',
    },
  },
} as const satisfies MessageTree;

/** Verschachtelte Message-Keys aus `de`, Blattwerte auf `string` verbreitert (siehe `Widen`). */
export type Messages = Widen<typeof de>;
export default de;
