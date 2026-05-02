/**
 * Azure Functions entry — side-effect registrations for HTTP triggers.
 * @see https://learn.microsoft.com/azure/azure-functions/functions-node-upgrade-v4
 */
import './functions/health';
import './functions/answer.create';
import './functions/answer.get';
import './functions/legalReview.approve';
import './functions/legalReview.reject';
