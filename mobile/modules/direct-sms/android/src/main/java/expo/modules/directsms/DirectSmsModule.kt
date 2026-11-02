package expo.modules.directsms

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

private const val SEND_TIMEOUT_MS = 60_000L

class SmsPermissionException :
  CodedException("ERR_SMS_PERMISSION", "Permission to send SMS was not granted", null)

class SmsSendException(message: String) :
  CodedException("ERR_SMS_SEND", message, null)

/**
 * Sends SMS directly through the phone's SIM (Android SmsManager), without opening the
 * messaging app. Used for SOS so alerts work with only cell signal: no internet, no server.
 *
 * sendSmsAsync resolves only after Android reports every part as sent, and rejects on failure,
 * so the app never claims an alert went out when it did not.
 */
class DirectSmsModule : Module() {
  private val permissionsManager: Permissions
    get() = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()

  override fun definition() = ModuleDefinition {
    Name("DirectSms")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      val feature = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        PackageManager.FEATURE_TELEPHONY_MESSAGING
      } else {
        PackageManager.FEATURE_TELEPHONY
      }
      context.packageManager.hasSystemFeature(feature)
    }

    AsyncFunction("requestPermissionAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        permissionsManager,
        promise,
        Manifest.permission.SEND_SMS
      )
    }

    AsyncFunction("sendSmsAsync") { phoneNumber: String, message: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject(SmsPermissionException())
        return@AsyncFunction
      }

      val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(SmsManager::class.java)
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }

      val parts = smsManager.divideMessage(message)
      val action = "expo.modules.directsms.SENT_${UUID.randomUUID()}"
      val remaining = AtomicInteger(parts.size)
      val settled = AtomicBoolean(false)
      val handler = Handler(Looper.getMainLooper())
      lateinit var receiver: BroadcastReceiver

      fun finish(error: String?) {
        if (!settled.compareAndSet(false, true)) return
        handler.removeCallbacksAndMessages(null)
        try {
          context.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
          // already unregistered
        }
        if (error == null) promise.resolve(true) else promise.reject(SmsSendException(error))
      }

      receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          if (resultCode != Activity.RESULT_OK) {
            finish("The SMS could not be sent (error $resultCode). Check signal and load balance.")
          } else if (remaining.decrementAndGet() == 0) {
            finish(null)
          }
        }
      }

      ContextCompat.registerReceiver(
        context,
        receiver,
        IntentFilter(action),
        ContextCompat.RECEIVER_NOT_EXPORTED
      )

      val sentIntents = ArrayList<PendingIntent>(parts.size)
      for (i in parts.indices) {
        val intent = Intent(action).setPackage(context.packageName)
        sentIntents.add(
          PendingIntent.getBroadcast(
            context,
            i,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ONE_SHOT
          )
        )
      }

      handler.postDelayed({ finish("Timed out waiting for the SMS to send.") }, SEND_TIMEOUT_MS)

      try {
        smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null)
      } catch (e: Exception) {
        finish(e.message ?: "The SMS could not be sent.")
      }
    }
  }
}
