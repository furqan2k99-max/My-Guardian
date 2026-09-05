package com.myguardian.elder.data

import com.google.android.gms.tasks.Task
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Coroutine bridge for GMS Tasks, shared by the auth helpers. */
internal suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { cont ->
    addOnCompleteListener { task ->
        if (task.isSuccessful) {
            cont.resume(task.result!!)
        } else {
            cont.resumeWithException(task.exception ?: Exception("Task failed"))
        }
    }
}