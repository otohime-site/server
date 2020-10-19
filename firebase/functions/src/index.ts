import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

// https://github.com/hasura/graphql-engine/blob/master/community/sample-apps/firebase-jwt/functions/index.js
export const processSignup = functions.auth.user().onCreate(async user => {
  const customClaims = {
    'https://hasura.io/jwt/claims': {
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': ['user'],
      'x-hasura-user-id': user.uid
    }
  }
  try {
    await admin.auth().setCustomUserClaims(user.uid, customClaims)
    const metadataRef = admin.database().ref(`metadata/${user.uid}`)
    return await metadataRef.set({ refreshTime: new Date().getTime() })
  } catch (error) {
    console.log(error)
  }
})
