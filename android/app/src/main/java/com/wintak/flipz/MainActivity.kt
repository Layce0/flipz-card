package com.wintak.flipz

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(BillingPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
