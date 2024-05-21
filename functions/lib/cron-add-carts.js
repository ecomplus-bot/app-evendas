const { logger } = require('firebase-functions')
const axios = require('axios')
const { firestore } = require('firebase-admin')

module.exports = async ({ appSdk }) => {
  const d = new Date()
  const snapshot = await firestore().collection('cart_to_add')
    .where('sendAt', '<=', d)
    .orderBy('sendAt')
    .limit(100)
    .get()
  const { docs } = snapshot
  logger.info(`${docs.length} carts to add`)

  for (let i = 0; i < docs.length; i++) {
    const { storeId, data, url } = docs[i].data()
    const cartId = docs[i].ref.id
    console.log('cart id', cartId)
    let cart
    try {
      cart = (await appSdk.apiRequest(storeId, `/carts/${cartId}.json`)).response.data
    } catch (error) {
      const status = error.response?.status
      await docs[i].ref.delete()
      if (status > 400 && status < 500) {
        logger.warn(`failed reading cart ${cartId} for #${storeId}`, {
          status,
          response: error.response.data
        })
      }
    }
    console.log('cart before send', cart.completed, 'index:', i, 'store', storeId, 'url', url)
    if (cart && !cart.completed) {
      data.cart = cart
      await axios({
        method: 'post',
        url,
        data
      }).then(async ({ status, data }) => {
        console.log(`> ${status}`, JSON.stringify(data))
      })
    }
    await docs[i].ref.delete()
  }
}