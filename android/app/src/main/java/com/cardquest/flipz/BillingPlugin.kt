package com.cardquest.flipz

import android.app.Activity
import com.android.billingclient.api.*
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "BillingPlugin")
class BillingPlugin : Plugin() {

    private var billingClient: BillingClient? = null
    private var pendingCall: PluginCall? = null

    override fun load() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()

        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    val params = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                    billingClient?.queryPurchasesAsync(params) { result, purchases ->
                        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            for (purchase in purchases) {
                                if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                                    val consumeParams = ConsumeParams.newBuilder()
                                        .setPurchaseToken(purchase.purchaseToken)
                                        .build()
                                    billingClient?.consumeAsync(consumeParams) { _, _ -> }
                                }
                            }
                        }
                    }
                }
            }

            override fun onBillingServiceDisconnected() {
                // Retry connection if needed
            }
        })
    }

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        val call = pendingCall ?: return@PurchasesUpdatedListener
        pendingCall = null

        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                if (purchases != null && purchases.isNotEmpty()) {
                    val purchase = purchases[0]
                    val result = JSObject()
                    result.put("purchaseToken", purchase.purchaseToken)
                    result.put("productId", purchase.products[0])
                    result.put("orderId", purchase.orderId ?: "")
                    call.resolve(result)

                    // Consume the purchase so it can be bought again
                    val consumeParams = ConsumeParams.newBuilder()
                        .setPurchaseToken(purchase.purchaseToken)
                        .build()
                    billingClient?.consumeAsync(consumeParams) { _, _ -> }
                } else {
                    call.reject("No purchases returned")
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                call.reject("USER_CANCELED", "User cancelled the purchase")
            }
            else -> {
                call.reject("BILLING_ERROR", "Billing error: ${billingResult.debugMessage}")
            }
        }
    }

    @PluginMethod
    fun purchaseProduct(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId == null) {
            call.reject("INVALID_ARGS", "productId is required")
            return
        }

        val client = billingClient
        if (client == null || !client.isReady) {
            call.reject("NOT_READY", "BillingClient is not ready")
            return
        }

        pendingCall = call

        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        client.queryProductDetailsAsync(params, object : ProductDetailsResponseListener {
            override fun onProductDetailsResponse(billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult) {
                val productDetailsList = productDetailsResult.productDetailsList
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || productDetailsList == null || productDetailsList.isEmpty()) {
                    pendingCall = null
                    call.reject("PRODUCT_NOT_FOUND", "Product not found: $productId")
                    return
                }

                val productDetails = productDetailsList[0]
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)
                            .build()
                    )
                )
                .build()

                val activity = activity
                if (activity != null) {
                    client.launchBillingFlow(activity, flowParams)
                } else {
                    pendingCall = null
                    call.reject("NO_ACTIVITY", "No activity available")
                }
            }
        })
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val productIdsArray = call.getArray("productIds")
        if (productIdsArray == null || productIdsArray.length() == 0) {
            call.reject("INVALID_ARGS", "productIds is required")
            return
        }

        val client = billingClient
        if (client == null || !client.isReady) {
            call.reject("NOT_READY", "BillingClient is not ready")
            return
        }

        val productList = mutableListOf<QueryProductDetailsParams.Product>()
        for (i in 0 until productIdsArray.length()) {
            productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productIdsArray.getString(i))
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            )
        }

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        client.queryProductDetailsAsync(params, object : ProductDetailsResponseListener {
            override fun onProductDetailsResponse(billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult) {
                val productDetailsList = productDetailsResult.productDetailsList
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
                    val prices = JSObject()
                    for (productDetails in productDetailsList) {
                        val price = productDetails.oneTimePurchaseOfferDetails?.formattedPrice
                        if (price != null) {
                            prices.put(productDetails.productId, price)
                        }
                    }
                    val result = JSObject()
                    result.put("prices", prices)
                    call.resolve(result)
                } else {
                    call.reject("ERROR", "Failed to query products")
                }
            }
        })
    }
}
